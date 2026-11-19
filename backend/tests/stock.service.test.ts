import { describe, it, expect, beforeEach } from '@jest/globals';
import { StockService } from '../src/services/stock.service';
import {
  IStockRepository,
  StockWithRelations,
  StockWithWarehouse,
  MovementWithRelations
} from '../src/repositories/stock.repository';
import { IProductRepository, ProductWithCategories } from '../src/repositories/product.repository';
import { Warehouse, WarehouseStock, StockMovement, Product } from '../src/domain/models';
import {
  ReceiveStockDto,
  RecordMovementDto,
  StockMovementFilterDto,
  CreateProductDto,
  UpdateProductDto,
  ProductFilterDto
} from '../src/types';
import { DomainValidationError, NotFoundError } from '../src/errors';

class MockStockRepository implements IStockRepository {
  warehouses: Warehouse[] = [];
  stocks: WarehouseStock[] = [];
  movements: StockMovement[] = [];
  nextMovementId = 1;

  async findAllWarehouses(): Promise<Warehouse[]> {
    return this.warehouses;
  }

  async findWarehouseById(id: number): Promise<Warehouse | null> {
    return this.warehouses.find((w) => w.id === id) || null;
  }

  async findWarehouseByCode(code: string): Promise<Warehouse | null> {
    return this.warehouses.find((w) => w.code.toUpperCase() === code.toUpperCase()) || null;
  }

  async findStock(warehouseId: number, productId: number): Promise<WarehouseStock | null> {
    return (
      this.stocks.find((s) => s.warehouseId === warehouseId && s.productId === productId) || null
    );
  }

  async findStocksByProductId(productId: number): Promise<StockWithWarehouse[]> {
    return this.stocks
      .filter((s) => s.productId === productId)
      .map((s) => ({
        ...s,
        warehouse: this.warehouses.find((w) => w.id === s.warehouseId)!
      }));
  }

  async findAllStocks(): Promise<StockWithRelations[]> {
    return this.stocks.map((s) => ({
      ...s,
      product: {} as Product,
      warehouse: this.warehouses.find((w) => w.id === s.warehouseId)!
    }));
  }

  async upsertStock(
    warehouseId: number,
    productId: number,
    initialPhysical = 0,
    initialReserved = 0
  ): Promise<WarehouseStock> {
    let s = await this.findStock(warehouseId, productId);
    if (!s) {
      s = {
        id: this.stocks.length + 1,
        warehouseId,
        productId,
        physicalQuantity: initialPhysical,
        reservedQuantity: initialReserved
      };
      this.stocks.push(s);
    }
    return s;
  }

  async updateStockQuantities(
    warehouseId: number,
    productId: number,
    data: { physicalQuantity?: number; reservedQuantity?: number }
  ): Promise<WarehouseStock> {
    let s = await this.findStock(warehouseId, productId);
    if (!s) {
      s = {
        id: this.stocks.length + 1,
        warehouseId,
        productId,
        physicalQuantity: data.physicalQuantity ?? 0,
        reservedQuantity: data.reservedQuantity ?? 0
      };
      this.stocks.push(s);
    } else {
      if (data.physicalQuantity !== undefined) s.physicalQuantity = data.physicalQuantity;
      if (data.reservedQuantity !== undefined) s.reservedQuantity = data.reservedQuantity;
    }
    return s;
  }

  async recordMovement(data: RecordMovementDto): Promise<StockMovement> {
    const mov: StockMovement = {
      id: this.nextMovementId++,
      productId: data.productId,
      warehouseId: data.warehouseId,
      orderId: data.orderId ?? null,
      movementType: data.movementType,
      quantityChange: data.quantityChange,
      quantityAfter: data.quantityAfter,
      reason: data.reason ?? null,
      note: data.note ?? null,
      createdAt: new Date()
    };
    this.movements.push(mov);
    return mov;
  }

  async findMovements(filters?: StockMovementFilterDto): Promise<MovementWithRelations[]> {
    return this.movements.map((m) => ({
      ...m,
      product: {} as Product,
      warehouse: this.warehouses.find((w) => w.id === m.warehouseId)!
    }));
  }

  async executeInTransaction<T>(operation: (repo: IStockRepository) => Promise<T>): Promise<T> {
    return operation(this);
  }
}

class MockProductRepository implements IProductRepository {
  products: Product[] = [];

  async findAll(filters?: ProductFilterDto): Promise<ProductWithCategories[]> {
    return this.products
      .filter((p) => {
        if (filters?.isActive !== undefined && p.isActive !== filters.isActive) return false;
        return true;
      })
      .map((p) => ({ ...p, categories: [] }));
  }

  async findById(id: number): Promise<ProductWithCategories | null> {
    const product = this.products.find((p) => p.id === id);
    return product ? { ...product, categories: [] } : null;
  }

  async findByCode(code: string): Promise<ProductWithCategories | null> {
    const product = this.products.find((p) => p.code === code);
    return product ? { ...product, categories: [] } : null;
  }

  async create(data: CreateProductDto): Promise<ProductWithCategories> {
    const product: Product = {
      id: this.products.length + 1,
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      purchasePrice: data.purchasePrice,
      sellingPrice: data.sellingPrice,
      minStockLimit: data.minStockLimit ?? 5,
      isActive: true,
      isVariantOfId: data.isVariantOfId ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.products.push(product);
    return { ...product, categories: [] };
  }

  async update(id: number, data: UpdateProductDto): Promise<ProductWithCategories> {
    const p = this.products.find((product) => product.id === id);
    if (!p) throw new Error('Not found');
    Object.assign(p, data);
    return { ...p, categories: [] };
  }

  async delete(id: number): Promise<ProductWithCategories> {
    const p = this.products.find((product) => product.id === id);
    if (!p) throw new Error('Not found');
    p.isActive = false;
    return { ...p, categories: [] };
  }
}

describe('StockService (Doménová vrstva zásob a pohybů)', () => {
  let stockRepo: MockStockRepository;
  let productRepo: MockProductRepository;
  let stockService: StockService;

  beforeEach(() => {
    stockRepo = new MockStockRepository();
    productRepo = new MockProductRepository();
    stockService = new StockService(stockRepo, productRepo);

    // Výchozí testovací sklady dle zadání Dřevěnky
    stockRepo.warehouses = [
      {
        id: 1,
        code: 'WH-HK',
        name: 'Centrála Hradec Králové',
        address: 'Pospíšilova 312',
        isSeasonal: false
      },
      {
        id: 2,
        code: 'WH-TRB',
        name: 'Sezónní garáž Třebechovice',
        address: 'Pod Rybníkem 88',
        isSeasonal: true
      }
    ];

    // Výchozí testovací produkt
    productRepo.products = [
      {
        id: 10,
        code: 'KACA-01',
        name: 'Tradiční káča buk',
        description: 'Testovací káča',
        purchasePrice: 60,
        sellingPrice: 120,
        minStockLimit: 10,
        isActive: true,
        isVariantOfId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 20,
        code: 'VYRAZENO-01',
        name: 'Vyřazená hračka',
        description: 'Už se nevyrábí',
        purchasePrice: 50,
        sellingPrice: 100,
        minStockLimit: 5,
        isActive: false,
        isVariantOfId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  });

  describe('receiveStock (Příjem zboží na sklad)', () => {
    it('měl by úspěšně naskladnit zboží a zaznamenat auditní pohyb RECEIPT', async () => {
      const dto: ReceiveStockDto = {
        productId: 10,
        warehouseId: 1,
        quantity: 25,
        reason: 'Dodávka od truhláře',
        note: 'První várka včelí vosk'
      };

      const result = await stockService.receiveStock(dto);

      expect(result.warehouseStock.physicalQuantity).toBe(25);
      expect(result.warehouseStock.reservedQuantity).toBe(0);
      expect(result.warehouseStock.availableQuantity).toBe(25);

      expect(result.movement).toBeDefined();
      expect(result.movement.movementType).toBe('RECEIPT');
      expect(result.movement.quantityChange).toBe(25);
      expect(result.movement.quantityAfter).toBe(25);
      expect(result.movement.reason).toBe('Dodávka od truhláře');
      expect(result.movement.note).toBe('První várka včelí vosk');
    });

    it('měl by navýšit stávající zásobu na skladě při opakovaném příjmu', async () => {
      // Předem existující zásoba 10 ks, 2 ks rezervované
      stockRepo.stocks.push({
        id: 1,
        warehouseId: 1,
        productId: 10,
        physicalQuantity: 10,
        reservedQuantity: 2
      });

      const result = await stockService.receiveStock({
        productId: 10,
        warehouseId: 1,
        quantity: 15
      });

      expect(result.warehouseStock.physicalQuantity).toBe(25);
      expect(result.warehouseStock.reservedQuantity).toBe(2);
      expect(result.warehouseStock.availableQuantity).toBe(23); // 25 - 2
      expect(result.movement.quantityAfter).toBe(25);
      expect(result.movement.quantityChange).toBe(15);
    });

    it('měl by odmítnout nulové nebo záporné množství', async () => {
      await expect(
        stockService.receiveStock({
          productId: 10,
          warehouseId: 1,
          quantity: 0
        })
      ).rejects.toThrow(DomainValidationError);

      await expect(
        stockService.receiveStock({
          productId: 10,
          warehouseId: 1,
          quantity: -5
        })
      ).rejects.toThrow(DomainValidationError);
    });

    it('měl by odmítnout neceločíselné množství', async () => {
      await expect(
        stockService.receiveStock({
          productId: 10,
          warehouseId: 1,
          quantity: 3.5
        })
      ).rejects.toThrow(DomainValidationError);
    });

    it('měl by vyhodit NotFoundError pro neexistující produkt', async () => {
      await expect(
        stockService.receiveStock({
          productId: 9999,
          warehouseId: 1,
          quantity: 10
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('měl by vyhodit NotFoundError pro neexistující sklad', async () => {
      await expect(
        stockService.receiveStock({
          productId: 10,
          warehouseId: 9999,
          quantity: 10
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('měl by odmítnout naskladnění vyřazeného/neaktivního produktu', async () => {
      await expect(
        stockService.receiveStock({
          productId: 20, // isActive === false
          warehouseId: 1,
          quantity: 5
        })
      ).rejects.toThrow(DomainValidationError);
    });
  });

  describe('transferStock (Přesun mezi sklady)', () => {
    beforeEach(() => {
      stockRepo.stocks.push(
        { id: 1, warehouseId: 1, productId: 10, physicalQuantity: 25, reservedQuantity: 0 },
        { id: 2, warehouseId: 2, productId: 10, physicalQuantity: 5, reservedQuantity: 0 }
      );
    });

    it('měl by přesunout kusy a zapsat spárované pohyby TRANSFER_OUT a TRANSFER_IN', async () => {
      const result = await stockService.transferStock({
        productId: 10,
        sourceWarehouseId: 1,
        targetWarehouseId: 2,
        quantity: 10,
        note: 'Zimní zásoby do garáže'
      });

      expect(result.source.physicalQuantity).toBe(15);
      expect(result.target.physicalQuantity).toBe(15);
      expect(result.movements).toHaveLength(2);

      const [out, incoming] = result.movements;
      expect(out.movementType).toBe('TRANSFER_OUT');
      expect(out.quantityChange).toBe(-10);
      expect(out.quantityAfter).toBe(15);
      expect(out.note).toBe('Zimní zásoby do garáže');

      expect(incoming.movementType).toBe('TRANSFER_IN');
      expect(incoming.quantityChange).toBe(10);
      expect(incoming.quantityAfter).toBe(15);

      // Oba pohyby odkazují na stejné číslo převodky
      const transferNumber = out.reason?.match(/PREV-\d+/)?.[0];
      expect(transferNumber).toBeDefined();
      expect(incoming.reason).toContain(transferNumber!);
    });

    it('měl by vytvořit skladovou kartu v cíli, pokud tam ještě neexistuje', async () => {
      stockRepo.stocks = [
        { id: 1, warehouseId: 1, productId: 10, physicalQuantity: 10, reservedQuantity: 0 }
      ];

      const result = await stockService.transferStock({
        productId: 10,
        sourceWarehouseId: 1,
        targetWarehouseId: 2,
        quantity: 4
      });

      expect(result.source.physicalQuantity).toBe(6);
      expect(result.target.physicalQuantity).toBe(4);
      expect(stockRepo.stocks).toHaveLength(2);
    });

    it('měl by odmítnout přesun rezervovaných kusů (nedostatek volných zásob)', async () => {
      stockRepo.stocks[0].physicalQuantity = 10;
      stockRepo.stocks[0].reservedQuantity = 3; // volných je 7

      const result = await stockService.transferStock({
        productId: 10,
        sourceWarehouseId: 1,
        targetWarehouseId: 2,
        quantity: 7
      });
      expect(result.source.physicalQuantity).toBe(3);

      await expect(
        stockService.transferStock({
          productId: 10,
          sourceWarehouseId: 1,
          targetWarehouseId: 2,
          quantity: 8
        })
      ).rejects.toThrow('Nedostatek volných zásob pro přesun.');
    });

    it('měl by odmítnout shodný zdroj a cíl', async () => {
      await expect(
        stockService.transferStock({
          productId: 10,
          sourceWarehouseId: 1,
          targetWarehouseId: 1,
          quantity: 5
        })
      ).rejects.toThrow(DomainValidationError);
    });

    it('měl by odmítnout nekladné nebo neceločíselné množství', async () => {
      for (const quantity of [0, -5, 2.5]) {
        await expect(
          stockService.transferStock({
            productId: 10,
            sourceWarehouseId: 1,
            targetWarehouseId: 2,
            quantity
          })
        ).rejects.toThrow(DomainValidationError);
      }
    });

    it('měl by vyhodit NotFoundError pro neexistující produkt nebo sklad', async () => {
      await expect(
        stockService.transferStock({
          productId: 9999,
          sourceWarehouseId: 1,
          targetWarehouseId: 2,
          quantity: 1
        })
      ).rejects.toThrow(NotFoundError);

      await expect(
        stockService.transferStock({
          productId: 10,
          sourceWarehouseId: 9999,
          targetWarehouseId: 2,
          quantity: 1
        })
      ).rejects.toThrow(NotFoundError);

      await expect(
        stockService.transferStock({
          productId: 10,
          sourceWarehouseId: 1,
          targetWarehouseId: 9999,
          quantity: 1
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('reconcileInventory (Inventura)', () => {
    beforeEach(() => {
      stockRepo.stocks.push({
        id: 1,
        warehouseId: 1,
        productId: 10,
        physicalQuantity: 10,
        reservedQuantity: 2
      });
    });

    it('měl by narovnat stav nahoru a zapsat pohyb INVENTORY_ADJUSTMENT', async () => {
      const result = await stockService.reconcileInventory({
        productId: 10,
        warehouseId: 1,
        actualPhysicalQuantity: 14,
        reason: 'Přebytek při inventuře garáže'
      });

      expect(result.difference).toBe(4);
      expect(result.warehouseStock.physicalQuantity).toBe(14);
      expect(result.warehouseStock.reservedQuantity).toBe(2);
      expect(result.warehouseStock.availableQuantity).toBe(12);

      expect(result.movement).not.toBeNull();
      expect(result.movement?.movementType).toBe('INVENTORY_ADJUSTMENT');
      expect(result.movement?.quantityChange).toBe(4);
      expect(result.movement?.quantityAfter).toBe(14);
      expect(result.movement?.reason).toBe('Přebytek při inventuře garáže');
      expect(stockRepo.stocks[0].physicalQuantity).toBe(14);
    });

    it('měl by narovnat stav dolů (manko) se záporným rozdílem', async () => {
      const result = await stockService.reconcileInventory({
        productId: 10,
        warehouseId: 1,
        actualPhysicalQuantity: 7,
        reason: 'Manko při inventuře'
      });

      expect(result.difference).toBe(-3);
      expect(result.movement?.quantityChange).toBe(-3);
      expect(result.movement?.quantityAfter).toBe(7);
    });

    it('měl by při shodě stavu nic neměnit a nezaložit pohyb', async () => {
      const result = await stockService.reconcileInventory({
        productId: 10,
        warehouseId: 1,
        actualPhysicalQuantity: 10,
        reason: 'Kontrolní inventura'
      });

      expect(result.difference).toBe(0);
      expect(result.movement).toBeNull();
      expect(stockRepo.movements).toHaveLength(0);
    });

    it('měl by odmítnout záporný nebo neceločíselný stav', async () => {
      await expect(
        stockService.reconcileInventory({
          productId: 10,
          warehouseId: 1,
          actualPhysicalQuantity: -1,
          reason: 'Chyba'
        })
      ).rejects.toThrow(DomainValidationError);

      await expect(
        stockService.reconcileInventory({
          productId: 10,
          warehouseId: 1,
          actualPhysicalQuantity: 3.5,
          reason: 'Chyba'
        })
      ).rejects.toThrow(DomainValidationError);
    });

    it('měl by vyžadovat textový důvod rozdílu', async () => {
      await expect(
        stockService.reconcileInventory({
          productId: 10,
          warehouseId: 1,
          actualPhysicalQuantity: 12,
          reason: '   '
        })
      ).rejects.toThrow(DomainValidationError);
    });

    it('měl by odmítnout stav nižší než rezervované množství (drží invariant zásob)', async () => {
      // Na skladě je fyzicky 10, rezervované 2 -> stav 1 by nechal rezervaci nad fyzickým stavem
      await expect(
        stockService.reconcileInventory({
          productId: 10,
          warehouseId: 1,
          actualPhysicalQuantity: 1,
          reason: 'Manko'
        })
      ).rejects.toThrow('nesmí být nižší než rezervované množství (2 ks)');
    });

    it('měl by vyhodit NotFoundError pro neexistující produkt nebo sklad', async () => {
      await expect(
        stockService.reconcileInventory({
          productId: 9999,
          warehouseId: 1,
          actualPhysicalQuantity: 1,
          reason: 'Inventura'
        })
      ).rejects.toThrow(NotFoundError);

      await expect(
        stockService.reconcileInventory({
          productId: 10,
          warehouseId: 9999,
          actualPhysicalQuantity: 1,
          reason: 'Inventura'
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getStockOverview & getStocksByProduct', () => {
    it('měl by správně spočítat celkové zásoby napříč sklady a detekovat nízký stav', async () => {
      // 3 ks v HK, 2 ks v Garáži => celkem 5 ks (minimum je 10 ks)
      stockRepo.stocks.push(
        {
          id: 1,
          warehouseId: 1,
          productId: 10,
          physicalQuantity: 3,
          reservedQuantity: 1
        },
        {
          id: 2,
          warehouseId: 2,
          productId: 10,
          physicalQuantity: 2,
          reservedQuantity: 0
        }
      );

      const overview = await stockService.getStockOverview();

      expect(overview).toHaveLength(1); // Pouze aktivní produkt 10
      const item = overview[0];
      expect(item.productId).toBe(10);
      expect(item.totalPhysicalQuantity).toBe(5);
      expect(item.totalReservedQuantity).toBe(1);
      expect(item.totalAvailableQuantity).toBe(4);
      expect(item.isLowStock).toBe(true); // 5 <= 10 (minStockLimit)
    });

    it('měl by vrátit skladové karty pro konkrétní produkt', async () => {
      stockRepo.stocks.push({
        id: 1,
        warehouseId: 1,
        productId: 10,
        physicalQuantity: 8,
        reservedQuantity: 0
      });

      const cards = await stockService.getStocksByProduct(10);
      expect(cards).toHaveLength(1);
      expect(cards[0].warehouse.name).toBe('Centrála Hradec Králové');
      expect(cards[0].physicalQuantity).toBe(8);
    });

    it('měl by vyhodit NotFoundError při hledání karet neexistujícího produktu', async () => {
      await expect(stockService.getStocksByProduct(9999)).rejects.toThrow(NotFoundError);
    });
  });
});
