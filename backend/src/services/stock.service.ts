import { IStockRepository, StockWithWarehouse, MovementWithRelations } from '../repositories/stock.repository';
import { IProductRepository } from '../repositories/product.repository';
import {
  ReceiveStockDto,
  StockMovementFilterDto,
  ProductStockOverviewDto,
  WarehouseStockDetail
} from '../types/stock.types';
import { DomainValidationError, NotFoundError } from '../errors';

export class StockService {
  constructor(
    private readonly stockRepo: IStockRepository,
    private readonly productRepo: IProductRepository
  ) {}

  /**
   * Příjem zboží na sklad (RECEIPT)
   * Vynucuje: kladné celé množství, existující aktivní produkt, existující sklad.
   * Zajišťuje: atomické navýšení fyzické zásoby a vytvoření neměnného auditního záznamu o pohybu.
   */
  async receiveStock(dto: ReceiveStockDto): Promise<{
    warehouseStock: {
      warehouseId: number;
      productId: number;
      physicalQuantity: number;
      reservedQuantity: number;
      availableQuantity: number;
    };
    movement: MovementWithRelations | any;
  }> {
    // 1. Validace množství
    if (
      dto.quantity === undefined ||
      dto.quantity === null ||
      !Number.isInteger(dto.quantity) ||
      dto.quantity <= 0
    ) {
      throw new DomainValidationError('Množství pro naskladnění musí být kladné celé číslo větší než 0.');
    }

    // 2. Kontrola existence a aktivity produktu
    const product = await this.productRepo.findById(dto.productId);
    if (!product) {
      throw new NotFoundError(`Produkt s ID ${dto.productId} nebyl nalezen.`);
    }
    if (!product.isActive) {
      throw new DomainValidationError(`Nelze naskladnit neaktivní nebo vyřazený produkt '${product.name}'.`);
    }

    // 3. Kontrola existence skladu
    const warehouse = await this.stockRepo.findWarehouseById(dto.warehouseId);
    if (!warehouse) {
      throw new NotFoundError(`Sklad s ID ${dto.warehouseId} nebyl nalezen.`);
    }

    // 4. Atomické provedení v transakci: aktualizace zásoby + zápis auditního logu
    return this.stockRepo.executeInTransaction(async (txRepo) => {
      const currentStock = await txRepo.findStock(dto.warehouseId, dto.productId);
      const currentPhysical = currentStock ? currentStock.physicalQuantity : 0;
      const currentReserved = currentStock ? currentStock.reservedQuantity : 0;

      const newPhysical = currentPhysical + dto.quantity;

      const updatedStock = await txRepo.updateStockQuantities(dto.warehouseId, dto.productId, {
        physicalQuantity: newPhysical,
        reservedQuantity: currentReserved
      });

      const movement = await txRepo.recordMovement({
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        movementType: 'RECEIPT',
        quantityChange: dto.quantity,
        quantityAfter: newPhysical,
        reason: dto.reason?.trim() || 'Běžný příjem na sklad',
        note: dto.note?.trim() || null
      });

      return {
        warehouseStock: {
          warehouseId: updatedStock.warehouseId,
          productId: updatedStock.productId,
          physicalQuantity: updatedStock.physicalQuantity,
          reservedQuantity: updatedStock.reservedQuantity,
          availableQuantity: updatedStock.physicalQuantity - updatedStock.reservedQuantity
        },
        movement
      };
    });
  }

  /**
   * Získá přehled zásob konkrétního produktu napříč všemi sklady
   */
  async getStocksByProduct(productId: number): Promise<StockWithWarehouse[]> {
    const product = await this.productRepo.findById(productId);
    if (!product) {
      throw new NotFoundError(`Produkt s ID ${productId} nebyl nalezen.`);
    }
    return this.stockRepo.findStocksByProductId(productId);
  }

  /**
   * Získá agregovaný přehled všech produktů a jejich skladových zásob napříč sklady
   * včetně výpočtu disponibilního stavu a flagu nízké zásoby.
   */
  async getStockOverview(): Promise<ProductStockOverviewDto[]> {
    const [products, allStocks, warehouses] = await Promise.all([
      this.productRepo.findAll({ isActive: true }),
      this.stockRepo.findAllStocks(),
      this.stockRepo.findAllWarehouses()
    ]);

    // Namapování skladových karet podle klíče `${productId}_${warehouseId}`
    const stockMap = new Map<string, { physical: number; reserved: number }>();
    for (const s of allStocks) {
      stockMap.set(`${s.productId}_${s.warehouseId}`, {
        physical: s.physicalQuantity,
        reserved: s.reservedQuantity
      });
    }

    return products.map((product) => {
      let totalPhysical = 0;
      let totalReserved = 0;

      const stockDetails: WarehouseStockDetail[] = warehouses.map((wh) => {
        const item = stockMap.get(`${product.id}_${wh.id}`) || { physical: 0, reserved: 0 };
        totalPhysical += item.physical;
        totalReserved += item.reserved;

        return {
          warehouseId: wh.id,
          warehouseCode: wh.code,
          warehouseName: wh.name,
          physicalQuantity: item.physical,
          reservedQuantity: item.reserved,
          availableQuantity: item.physical - item.reserved
        };
      });

      const totalAvailable = totalPhysical - totalReserved;

      return {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        minStockLimit: product.minStockLimit,
        stocks: stockDetails,
        totalPhysicalQuantity: totalPhysical,
        totalReservedQuantity: totalReserved,
        totalAvailableQuantity: totalAvailable,
        isLowStock: totalPhysical <= product.minStockLimit
      };
    });
  }

  /**
   * Seznam všech skladů (Hradec Králové, Garáž Třebechovice, ...)
   */
  async getAllWarehouses() {
    return this.stockRepo.findAllWarehouses();
  }

  /**
   * Čtení auditní knihy pohybů s filtry
   */
  async getMovements(filters?: StockMovementFilterDto): Promise<MovementWithRelations[]> {
    return this.stockRepo.findMovements(filters);
  }
}
