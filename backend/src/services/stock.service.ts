import { StockMovement } from '../domain/models';
import { IStockRepository, StockWithWarehouse, MovementWithRelations } from '../repositories/stock.repository';
import { IProductRepository } from '../repositories/product.repository';
import {
  ReceiveStockDto,
  TransferStockDto,
  InventoryAdjustmentDto,
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
   * Přesun zboží mezi sklady (TRANSFER_OUT + TRANSFER_IN)
   * Vynucuje: kladné celé množství, různý zdroj a cíl, dostatek VOLNÝCH zásob
   * (fyzický - rezervovaný) na zdrojovém skladu.
   * Zajišťuje: atomickou změnu obou skladů a dva spárované auditní pohyby
   * s odkazem na stejné číslo převodky.
   */
  async transferStock(dto: TransferStockDto): Promise<{
    source: {
      warehouseId: number;
      productId: number;
      physicalQuantity: number;
      reservedQuantity: number;
      availableQuantity: number;
    };
    target: {
      warehouseId: number;
      productId: number;
      physicalQuantity: number;
      reservedQuantity: number;
      availableQuantity: number;
    };
    movements: StockMovement[];
  }> {
    // 1. Validace množství
    if (
      dto.quantity === undefined ||
      dto.quantity === null ||
      !Number.isInteger(dto.quantity) ||
      dto.quantity <= 0
    ) {
      throw new DomainValidationError('Množství pro přesun musí být kladné celé číslo větší než 0.');
    }

    // 2. Zdroj a cíl musí být různé sklady
    if (dto.sourceWarehouseId === dto.targetWarehouseId) {
      throw new DomainValidationError('Zdrojový a cílový sklad nesmí být stejný.');
    }

    // 3. Existence produktu a obou skladů
    const product = await this.productRepo.findById(dto.productId);
    if (!product) {
      throw new NotFoundError(`Produkt s ID ${dto.productId} nebyl nalezen.`);
    }

    const sourceWarehouse = await this.stockRepo.findWarehouseById(dto.sourceWarehouseId);
    if (!sourceWarehouse) {
      throw new NotFoundError(`Sklad s ID ${dto.sourceWarehouseId} nebyl nalezen.`);
    }

    const targetWarehouse = await this.stockRepo.findWarehouseById(dto.targetWarehouseId);
    if (!targetWarehouse) {
      throw new NotFoundError(`Sklad s ID ${dto.targetWarehouseId} nebyl nalezen.`);
    }

    // 4. Atomicky: odečtení ve zdroji, přičtení v cíli + dva pohyby
    return this.stockRepo.executeInTransaction(async (txRepo) => {
      const sourceStock = await txRepo.findStock(dto.sourceWarehouseId, dto.productId);
      const sourcePhysical = sourceStock ? sourceStock.physicalQuantity : 0;
      const sourceReserved = sourceStock ? sourceStock.reservedQuantity : 0;

      // Přesouvat lze jen to, co není rezervované objednávkami
      if (sourcePhysical - sourceReserved < dto.quantity) {
        throw new DomainValidationError('Nedostatek volných zásob pro přesun.');
      }

      const targetStock = await txRepo.findStock(dto.targetWarehouseId, dto.productId);
      const targetPhysical = targetStock ? targetStock.physicalQuantity : 0;
      const targetReserved = targetStock ? targetStock.reservedQuantity : 0;

      const updatedSource = await txRepo.updateStockQuantities(dto.sourceWarehouseId, dto.productId, {
        physicalQuantity: sourcePhysical - dto.quantity,
        reservedQuantity: sourceReserved
      });

      const updatedTarget = await txRepo.updateStockQuantities(dto.targetWarehouseId, dto.productId, {
        physicalQuantity: targetPhysical + dto.quantity,
        reservedQuantity: targetReserved
      });

      // Společné číslo převodky páruje oba pohyby v auditní knize
      const transferNumber = `PREV-${Date.now()}`;
      const note = dto.note?.trim() || null;

      const movementOut = await txRepo.recordMovement({
        productId: dto.productId,
        warehouseId: dto.sourceWarehouseId,
        movementType: 'TRANSFER_OUT',
        quantityChange: -dto.quantity,
        quantityAfter: updatedSource.physicalQuantity,
        reason: `Převod ${transferNumber} do skladu ${targetWarehouse.code}`,
        note
      });

      const movementIn = await txRepo.recordMovement({
        productId: dto.productId,
        warehouseId: dto.targetWarehouseId,
        movementType: 'TRANSFER_IN',
        quantityChange: dto.quantity,
        quantityAfter: updatedTarget.physicalQuantity,
        reason: `Převod ${transferNumber} ze skladu ${sourceWarehouse.code}`,
        note
      });

      return {
        source: {
          warehouseId: updatedSource.warehouseId,
          productId: updatedSource.productId,
          physicalQuantity: updatedSource.physicalQuantity,
          reservedQuantity: updatedSource.reservedQuantity,
          availableQuantity: updatedSource.physicalQuantity - updatedSource.reservedQuantity
        },
        target: {
          warehouseId: updatedTarget.warehouseId,
          productId: updatedTarget.productId,
          physicalQuantity: updatedTarget.physicalQuantity,
          reservedQuantity: updatedTarget.reservedQuantity,
          availableQuantity: updatedTarget.physicalQuantity - updatedTarget.reservedQuantity
        },
        movements: [movementOut, movementIn]
      };
    });
  }

  /**
   * Inventura – narovnání fyzického stavu na zjištěný skutečný počet kusů.
   * Vynucuje: nezáporný celý počet, povinný textový důvod rozdílu.
   * Zajišťuje: při nenulovém rozdílu zápis auditního pohybu INVENTORY_ADJUSTMENT,
   * při shodě se nic nemění a pohyb se nezakládá.
   */
  async reconcileInventory(dto: InventoryAdjustmentDto): Promise<{
    warehouseStock: {
      warehouseId: number;
      productId: number;
      physicalQuantity: number;
      reservedQuantity: number;
      availableQuantity: number;
    };
    movement: StockMovement | null;
    difference: number;
  }> {
    // 1. Validace zjištěného stavu a důvodu
    if (
      dto.actualPhysicalQuantity === undefined ||
      dto.actualPhysicalQuantity === null ||
      !Number.isInteger(dto.actualPhysicalQuantity) ||
      dto.actualPhysicalQuantity < 0
    ) {
      throw new DomainValidationError('Inventurní stav musí být nezáporné celé číslo.');
    }
    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new DomainValidationError('Důvod inventurního rozdílu je povinný.');
    }

    // 2. Existence produktu a skladu
    const product = await this.productRepo.findById(dto.productId);
    if (!product) {
      throw new NotFoundError(`Produkt s ID ${dto.productId} nebyl nalezen.`);
    }

    const warehouse = await this.stockRepo.findWarehouseById(dto.warehouseId);
    if (!warehouse) {
      throw new NotFoundError(`Sklad s ID ${dto.warehouseId} nebyl nalezen.`);
    }

    // 3. Atomicky: nastavení stavu + inventurní pohyb
    return this.stockRepo.executeInTransaction(async (txRepo) => {
      const currentStock = await txRepo.findStock(dto.warehouseId, dto.productId);
      const currentPhysical = currentStock ? currentStock.physicalQuantity : 0;
      const currentReserved = currentStock ? currentStock.reservedQuantity : 0;

      // Rezervace nesmí zůstat nad fyzickým stavem (drží to i CHECK v databázi)
      if (dto.actualPhysicalQuantity < currentReserved) {
        throw new DomainValidationError(
          `Inventurní stav nesmí být nižší než rezervované množství (${currentReserved} ks).`
        );
      }

      const difference = dto.actualPhysicalQuantity - currentPhysical;

      // Stav sedí – inventura nic nemění a auditní kniha zůstává čistá
      if (difference === 0) {
        return {
          warehouseStock: {
            warehouseId: dto.warehouseId,
            productId: dto.productId,
            physicalQuantity: currentPhysical,
            reservedQuantity: currentReserved,
            availableQuantity: currentPhysical - currentReserved
          },
          movement: null,
          difference: 0
        };
      }

      const updatedStock = await txRepo.updateStockQuantities(dto.warehouseId, dto.productId, {
        physicalQuantity: dto.actualPhysicalQuantity,
        reservedQuantity: currentReserved
      });

      const movement = await txRepo.recordMovement({
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        movementType: 'INVENTORY_ADJUSTMENT',
        quantityChange: difference,
        quantityAfter: dto.actualPhysicalQuantity,
        reason: dto.reason.trim(),
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
        movement,
        difference
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
