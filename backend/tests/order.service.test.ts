import { describe, it, expect, beforeEach } from '@jest/globals';
import { Product, Warehouse, WarehouseStock, StockMovement, Customer } from '@prisma/client';
import { OrderService } from '../src/services/order.service';
import { IOrderRepository } from '../src/repositories/order.repository';
import { ICustomerRepository } from '../src/repositories/customer.repository';
import { IProductRepository, ProductWithCategories } from '../src/repositories/product.repository';
import {
  IStockRepository,
  MovementWithRelations,
  StockWithRelations,
  StockWithWarehouse
} from '../src/repositories/stock.repository';
import {
  CreateCustomerDto,
  CreateOrderDto,
  CreateOrderWithItemsDto,
  OrderFilterDto,
  OrderStatus,
  OrderWithRelations,
  CreateOrderItemDto,
  RecordMovementDto,
  StockMovementFilterDto
} from '../src/types';
import { DomainValidationError, NotFoundError } from '../src/errors';

class MockProductRepository implements IProductRepository {
  products: Product[] = [];

  async findAll(): Promise<ProductWithCategories[]> {
    return this.products.map((p) => ({ ...p, categories: [] }));
  }

  async findById(id: number): Promise<ProductWithCategories | null> {
    const product = this.products.find((p) => p.id === id);
    return product ? { ...product, categories: [] } : null;
  }

  async findByCode(): Promise<ProductWithCategories | null> {
    return null;
  }

  async create(): Promise<ProductWithCategories> {
    throw new Error('Nepoužito v testu');
  }

  async update(): Promise<ProductWithCategories> {
    throw new Error('Nepoužito v testu');
  }

  async delete(): Promise<ProductWithCategories> {
    throw new Error('Nepoužito v testu');
  }
}

class MockCustomerRepository implements ICustomerRepository {
  customers: Customer[] = [];

  async findById(id: number): Promise<Customer | null> {
    return this.customers.find((c) => c.id === id) || null;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    return this.customers.find((c) => c.email === email.trim().toLowerCase()) || null;
  }

  async findAll(): Promise<Customer[]> {
    return this.customers;
  }

  async findOrCreate(data: CreateCustomerDto): Promise<Customer> {
    const email = data.email.trim().toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) return existing;

    const customer: Customer = {
      id: this.customers.length + 1,
      email,
      name: data.name.trim(),
      phone: data.phone.trim(),
      street: data.street.trim(),
      city: data.city.trim(),
      zip: data.zip.trim(),
      createdAt: new Date()
    };
    this.customers.push(customer);
    return customer;
  }
}

class MockStockRepository implements IStockRepository {
  warehouses: Warehouse[] = [];
  stocks: WarehouseStock[] = [];
  movements: StockMovement[] = [];
  private nextMovementId = 1;

  async findAllWarehouses(): Promise<Warehouse[]> {
    return this.warehouses;
  }

  async findWarehouseById(id: number): Promise<Warehouse | null> {
    return this.warehouses.find((w) => w.id === id) || null;
  }

  async findWarehouseByCode(code: string): Promise<Warehouse | null> {
    return this.warehouses.find((w) => w.code === code) || null;
  }

  async findStock(warehouseId: number, productId: number): Promise<WarehouseStock | null> {
    return (
      this.stocks.find((s) => s.warehouseId === warehouseId && s.productId === productId) || null
    );
  }

  async findStocksByProductId(): Promise<StockWithWarehouse[]> {
    return [];
  }

  async findAllStocks(): Promise<StockWithRelations[]> {
    return [];
  }

  async upsertStock(
    warehouseId: number,
    productId: number,
    initialPhysical = 0,
    initialReserved = 0
  ): Promise<WarehouseStock> {
    const existing = await this.findStock(warehouseId, productId);
    if (existing) return existing;
    const stock: WarehouseStock = {
      id: this.stocks.length + 1,
      warehouseId,
      productId,
      physicalQuantity: initialPhysical,
      reservedQuantity: initialReserved
    };
    this.stocks.push(stock);
    return stock;
  }

  async updateStockQuantities(
    warehouseId: number,
    productId: number,
    data: { physicalQuantity?: number; reservedQuantity?: number }
  ): Promise<WarehouseStock> {
    const stock = await this.upsertStock(warehouseId, productId);
    if (data.physicalQuantity !== undefined) stock.physicalQuantity = data.physicalQuantity;
    if (data.reservedQuantity !== undefined) stock.reservedQuantity = data.reservedQuantity;
    return stock;
  }

  async recordMovement(data: RecordMovementDto): Promise<StockMovement> {
    const movement: StockMovement = {
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
    this.movements.push(movement);
    return movement;
  }

  async findMovements(): Promise<MovementWithRelations[]> {
    return [];
  }

  async executeInTransaction<T>(operation: (repo: IStockRepository) => Promise<T>): Promise<T> {
    return operation(this);
  }
}

class MockOrderRepository implements IOrderRepository {
  orders: OrderWithRelations[] = [];
  private nextId = 1;

  constructor(
    private readonly stockRepo: MockStockRepository,
    private readonly productRepo: MockProductRepository,
    private readonly customerRepo: MockCustomerRepository
  ) {}

  async createOrderWithItems(data: CreateOrderWithItemsDto): Promise<OrderWithRelations> {
    const id = this.nextId++;
    const order = {
      id,
      orderNumber: data.orderNumber,
      customerId: data.customerId,
      status: data.status ?? 'PENDING',
      createdAt: new Date(),
      shippedAt: null,
      customer: (await this.customerRepo.findById(data.customerId))!,
      items: data.items.map((item, index) => ({
        id: index + 1,
        orderId: id,
        productId: item.productId,
        warehouseId: item.warehouseId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        product: this.productRepo.products.find((p) => p.id === item.productId)!,
        warehouse: this.stockRepo.warehouses.find((w) => w.id === item.warehouseId)!
      }))
    } as OrderWithRelations;

    this.orders.push(order);
    return order;
  }

  async findOrderById(id: number): Promise<OrderWithRelations | null> {
    return this.orders.find((o) => o.id === id) || null;
  }

  async findOrderByNumber(orderNumber: string): Promise<OrderWithRelations | null> {
    return this.orders.find((o) => o.orderNumber === orderNumber) || null;
  }

  async findAllOrders(_filters?: OrderFilterDto): Promise<OrderWithRelations[]> {
    return this.orders;
  }

  async updateOrderStatus(id: number, status: OrderStatus, shippedAt?: Date): Promise<OrderWithRelations> {
    const order = this.orders.find((o) => o.id === id)!;
    order.status = status;
    if (shippedAt !== undefined) {
      order.shippedAt = shippedAt;
    }
    return order;
  }

  async updateOrderItems(id: number, items: CreateOrderItemDto[]): Promise<OrderWithRelations> {
    const order = this.orders.find((o) => o.id === id)!;
    order.items = items.map((item, index) => ({
      id: index + 1,
      orderId: id,
      productId: item.productId,
      warehouseId: item.warehouseId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      product: this.productRepo.products.find((p) => p.id === item.productId)!,
      warehouse: this.stockRepo.warehouses.find((w) => w.id === item.warehouseId)!
    })) as never;
    return order;
  }

  /**
   * Simulace transakce: při chybě se rezervace vrátí do původního stavu,
   * aby šlo ověřit all-or-nothing chování služby.
   */
  async executeInTransaction<T>(
    operation: (orderRepo: IOrderRepository, stockRepo: IStockRepository) => Promise<T>
  ): Promise<T> {
    const snapshot = JSON.parse(JSON.stringify(this.stockRepo.stocks)) as WarehouseStock[];
    const movementsSnapshot = this.stockRepo.movements.length;
    try {
      return await operation(this, this.stockRepo);
    } catch (err) {
      this.stockRepo.stocks = snapshot;
      this.stockRepo.movements.length = movementsSnapshot;
      throw err;
    }
  }
}

const customerDto: CreateCustomerDto = {
  name: 'Jana Zákaznice',
  email: 'jana@example.com',
  phone: '+420 777 123 456',
  street: 'Dřevěná 12',
  city: 'Hradec Králové',
  zip: '500 02'
};

describe('OrderService (rezervace a fixace cen)', () => {
  let productRepo: MockProductRepository;
  let customerRepo: MockCustomerRepository;
  let stockRepo: MockStockRepository;
  let orderRepo: MockOrderRepository;
  let service: OrderService;

  beforeEach(() => {
    productRepo = new MockProductRepository();
    customerRepo = new MockCustomerRepository();
    stockRepo = new MockStockRepository();
    orderRepo = new MockOrderRepository(stockRepo, productRepo, customerRepo);
    service = new OrderService(orderRepo, customerRepo, productRepo, stockRepo);

    stockRepo.warehouses = [
      { id: 1, code: 'WH-HK', name: 'Centrální sklad Hradec Králové', address: 'Pospíšilova 312', isSeasonal: false },
      { id: 2, code: 'WH-TRB', name: 'Sezónní garáž Třebechovice', address: 'Pod Rybníkem 88', isSeasonal: true }
    ];

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
        id: 11,
        code: 'JEZEK-01',
        name: 'Ježek v kleci',
        description: 'Testovací hlavolam',
        purchasePrice: 100,
        sellingPrice: 250,
        minStockLimit: 5,
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

    stockRepo.stocks = [
      { id: 1, warehouseId: 1, productId: 10, physicalQuantity: 10, reservedQuantity: 0 },
      { id: 2, warehouseId: 1, productId: 11, physicalQuantity: 1, reservedQuantity: 0 }
    ];
  });

  const createOrder = (items: CreateOrderDto['items']): Promise<OrderWithRelations> =>
    service.createOrder({ customer: customerDto, items });

  it('měl by založit objednávku ve stavu RESERVED a rezervovat zásobu', async () => {
    const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 3 }]);

    expect(order.status).toBe('RESERVED');
    expect(order.orderNumber).toMatch(/^ORD-/);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(3);

    const stock = stockRepo.stocks.find((s) => s.productId === 10)!;
    expect(stock.reservedQuantity).toBe(3);
    expect(stock.physicalQuantity).toBe(10); // fyzický stav se při rezervaci nemění

    expect(orderRepo.orders).toHaveLength(1);
    expect(customerRepo.customers).toHaveLength(1);
  });

  it('měl by zafixovat cenu z ceníku v okamžiku objednávky', async () => {
    const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 1 }]);
    expect(order.items[0].unitPrice).toBe(120);

    // Změna ceníku později nesmí přepsat už zafixovanou cenu
    productRepo.products[0].sellingPrice = 999;
    expect(orderRepo.orders[0].items[0].unitPrice).toBe(120);
  });

  it('měl by odmítnout objednávku při nedostatku volných zásob', async () => {
    stockRepo.stocks[0].physicalQuantity = 2;

    await expect(
      createOrder([{ productId: 10, warehouseId: 1, quantity: 3 }])
    ).rejects.toThrow(
      'Nedostatek zásob: Produkt Tradiční káča buk má na skladě 2 ks, volných pouze 2 ks.'
    );

    expect(orderRepo.orders).toHaveLength(0);
    expect(stockRepo.stocks[0].reservedQuantity).toBe(0);
    expect(customerRepo.customers).toHaveLength(0);
  });

  it('měl by počítat disponibilní stav jako fyzický - rezervovaný', async () => {
    stockRepo.stocks[0].reservedQuantity = 8; // fyzicky 10, volné 2

    await expect(
      createOrder([{ productId: 10, warehouseId: 1, quantity: 3 }])
    ).rejects.toThrow(DomainValidationError);

    const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 2 }]);
    expect(order.items[0].quantity).toBe(2);
    expect(stockRepo.stocks[0].reservedQuantity).toBe(10);
  });

  it('měl by sečíst duplicitní položky stejného produktu a skladu', async () => {
    // 6 + 5 na skladě s 10 ks musí selhat, i když každá položka sama o sobě projde
    await expect(
      createOrder([
        { productId: 10, warehouseId: 1, quantity: 6 },
        { productId: 10, warehouseId: 1, quantity: 5 }
      ])
    ).rejects.toThrow('Nedostatek zásob');

    const order = await createOrder([
      { productId: 10, warehouseId: 1, quantity: 5 },
      { productId: 10, warehouseId: 1, quantity: 5 }
    ]);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(10);
    expect(stockRepo.stocks[0].reservedQuantity).toBe(10);
  });

  it('měl by při odmítnutí nezarezervovat nic z ostatních položek (all-or-nothing)', async () => {
    await expect(
      createOrder([
        { productId: 10, warehouseId: 1, quantity: 5 },
        { productId: 11, warehouseId: 1, quantity: 5 } // na skladě je jen 1 ks
      ])
    ).rejects.toThrow(DomainValidationError);

    expect(stockRepo.stocks.find((s) => s.productId === 10)!.reservedQuantity).toBe(0);
    expect(stockRepo.stocks.find((s) => s.productId === 11)!.reservedQuantity).toBe(0);
    expect(orderRepo.orders).toHaveLength(0);
  });

  it('měl by odmítnout objednávku bez položek', async () => {
    await expect(service.createOrder({ customer: customerDto, items: [] })).rejects.toThrow(
      'Objednávka musí obsahovat alespoň jednu položku.'
    );
  });

  it('měl by odmítnout nekladné nebo neceločíselné množství', async () => {
    for (const quantity of [0, -2, 1.5]) {
      await expect(
        createOrder([{ productId: 10, warehouseId: 1, quantity }])
      ).rejects.toThrow(DomainValidationError);
    }
  });

  it('měl by odmítnout neplatné údaje zákazníka', async () => {
    await expect(
      service.createOrder({
        customer: { ...customerDto, name: '   ' },
        items: [{ productId: 10, warehouseId: 1, quantity: 1 }]
      })
    ).rejects.toThrow(DomainValidationError);

    await expect(
      service.createOrder({
        customer: { ...customerDto, email: 'neni-email' },
        items: [{ productId: 10, warehouseId: 1, quantity: 1 }]
      })
    ).rejects.toThrow('E-mail zákazníka není platný.');
  });

  it('měl by vyhodit NotFoundError pro neexistující produkt nebo sklad', async () => {
    await expect(
      createOrder([{ productId: 999, warehouseId: 1, quantity: 1 }])
    ).rejects.toThrow(NotFoundError);

    await expect(
      createOrder([{ productId: 10, warehouseId: 999, quantity: 1 }])
    ).rejects.toThrow(NotFoundError);
  });

  it('měl by odmítnout objednávku vyřazeného produktu', async () => {
    stockRepo.stocks.push({
      id: 3,
      warehouseId: 1,
      productId: 20,
      physicalQuantity: 50,
      reservedQuantity: 0
    });

    await expect(
      createOrder([{ productId: 20, warehouseId: 1, quantity: 1 }])
    ).rejects.toThrow('Nelze objednat neaktivní produkt');
  });

  describe('shipOrder (expedice)', () => {
    it('měl by odepsat fyzické zásoby, uvolnit rezervaci a zapsat pohyb DISPATCH', async () => {
      const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 3 }]);

      const shipped = await service.shipOrder(order.id);

      expect(shipped.status).toBe('SHIPPED');
      expect(shipped.shippedAt).toBeInstanceOf(Date);

      const stock = stockRepo.stocks.find((s) => s.productId === 10)!;
      expect(stock.physicalQuantity).toBe(7);
      expect(stock.reservedQuantity).toBe(0);

      expect(stockRepo.movements).toHaveLength(1);
      const movement = stockRepo.movements[0];
      expect(movement.movementType).toBe('DISPATCH');
      expect(movement.quantityChange).toBe(-3);
      expect(movement.quantityAfter).toBe(7);
      expect(movement.orderId).toBe(order.id);
      expect(movement.reason).toContain(order.orderNumber);
    });

    it('měl by odmítnout expedici objednávky, která není RESERVED', async () => {
      const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 1 }]);
      await service.shipOrder(order.id);

      await expect(service.shipOrder(order.id)).rejects.toThrow(DomainValidationError);
    });

    it('měl by odmítnout neexistující objednávku', async () => {
      await expect(service.shipOrder(9999)).rejects.toThrow(NotFoundError);
    });

    it('měl by při chybějící rezervaci nic neodepsat ani nezapsat pohyb', async () => {
      const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 2 }]);
      stockRepo.stocks[0].reservedQuantity = 0; // simulace nekonzistence

      await expect(service.shipOrder(order.id)).rejects.toThrow('chybí rezervované kusy');

      expect(stockRepo.stocks[0].physicalQuantity).toBe(10);
      expect(stockRepo.movements).toHaveLength(0);
      expect((await orderRepo.findOrderById(order.id))!.status).toBe('RESERVED');
    });
  });

  describe('cancelOrder (storno)', () => {
    it('měl by uvolnit rezervaci a nastavit stav CANCELLED bez fyzického odpisu', async () => {
      const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 3 }]);

      const cancelled = await service.cancelOrder(order.id, 'Zákazník nezaplatil');

      expect(cancelled.status).toBe('CANCELLED');

      const stock = stockRepo.stocks.find((s) => s.productId === 10)!;
      expect(stock.reservedQuantity).toBe(0);
      expect(stock.physicalQuantity).toBe(10);
      // Storno nic fyzicky nepohybuje, auditní kniha zůstává čistá
      expect(stockRepo.movements).toHaveLength(0);
    });

    it('měl by odmítnout storno expedované objednávky', async () => {
      const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 1 }]);
      await service.shipOrder(order.id);

      await expect(service.cancelOrder(order.id, 'Pozdní storno')).rejects.toThrow(
        'Expedovanou objednávku nelze stornovat'
      );
    });

    it('měl by odmítnout opakované storno', async () => {
      const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 1 }]);
      await service.cancelOrder(order.id, 'První storno');

      await expect(service.cancelOrder(order.id, 'Druhé storno')).rejects.toThrow(
        'Objednávka je již stornována.'
      );
    });

    it('měl by vyžadovat důvod storna', async () => {
      const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 1 }]);

      await expect(service.cancelOrder(order.id, '   ')).rejects.toThrow(
        'Důvod storna je povinný.'
      );
    });

    it('měl by odmítnout neexistující objednávku', async () => {
      await expect(service.cancelOrder(9999, 'Test')).rejects.toThrow(NotFoundError);
    });
  });

  describe('objednávka ze dvou skladů (ADR-003)', () => {
    beforeEach(() => {
      stockRepo.stocks.push({
        id: 3,
        warehouseId: 2,
        productId: 10,
        physicalQuantity: 5,
        reservedQuantity: 0
      });
    });

    it('měl by rezervovat položky na různých skladech v jedné objednávce', async () => {
      const order = await createOrder([
        { productId: 10, warehouseId: 1, quantity: 2 },
        { productId: 10, warehouseId: 2, quantity: 3 }
      ]);

      expect(order.items).toHaveLength(2);
      expect(stockRepo.stocks.find((s) => s.warehouseId === 1)!.reservedQuantity).toBe(2);
      expect(stockRepo.stocks.find((s) => s.warehouseId === 2)!.reservedQuantity).toBe(3);
    });

    it('měl by expedicí odepsat z obou skladů a zapsat dva pohyby DISPATCH', async () => {
      const order = await createOrder([
        { productId: 10, warehouseId: 1, quantity: 2 },
        { productId: 10, warehouseId: 2, quantity: 3 }
      ]);

      await service.shipOrder(order.id);

      expect(stockRepo.stocks.find((s) => s.warehouseId === 1)!.physicalQuantity).toBe(8);
      expect(stockRepo.stocks.find((s) => s.warehouseId === 2)!.physicalQuantity).toBe(2);

      const dispatches = stockRepo.movements.filter((m) => m.movementType === 'DISPATCH');
      expect(dispatches).toHaveLength(2);
      expect(dispatches.map((m) => m.warehouseId).sort()).toEqual([1, 2]);
    });
  });

  describe('updateOrderItems (editace před expedicí, ADR-007)', () => {
    beforeEach(() => {
      stockRepo.stocks.push({
        id: 3,
        warehouseId: 2,
        productId: 10,
        physicalQuantity: 5,
        reservedQuantity: 0
      });
    });

    it('měl by přesunout položku na jiný sklad s přepočtem rezervací', async () => {
      const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 3 }]);

      const updated = await service.updateOrderItems(order.id, [
        { productId: 10, warehouseId: 2, quantity: 2 }
      ]);

      expect(updated.items).toHaveLength(1);
      expect(updated.items[0].warehouseId).toBe(2);
      expect(updated.items[0].quantity).toBe(2);

      expect(stockRepo.stocks.find((s) => s.warehouseId === 1)!.reservedQuantity).toBe(0);
      expect(stockRepo.stocks.find((s) => s.warehouseId === 2)!.reservedQuantity).toBe(2);
    });

    it('měl by umožnit editaci, která znovu použije právě uvolněnou rezervaci', async () => {
      // Objednávka blokuje celou zásobu; stejné množství musí jít potvrdit znovu
      const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 10 }]);

      const updated = await service.updateOrderItems(order.id, [
        { productId: 10, warehouseId: 1, quantity: 10 }
      ]);

      expect(updated.items[0].quantity).toBe(10);
      expect(stockRepo.stocks.find((s) => s.warehouseId === 1)!.reservedQuantity).toBe(10);
    });

    it('měl by odmítnout navýšení nad disponibilní stav a zachovat původní rezervaci', async () => {
      const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 2 }]);

      await expect(
        service.updateOrderItems(order.id, [{ productId: 10, warehouseId: 1, quantity: 12 }])
      ).rejects.toThrow('Nedostatek zásob');

      expect(stockRepo.stocks.find((s) => s.warehouseId === 1)!.reservedQuantity).toBe(2);
      const stored = await orderRepo.findOrderById(order.id);
      expect(stored!.items[0].quantity).toBe(2);
    });

    it('měl by sečíst duplicitní položky v nové verzi objednávky', async () => {
      const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 1 }]);

      await expect(
        service.updateOrderItems(order.id, [
          { productId: 10, warehouseId: 1, quantity: 6 },
          { productId: 10, warehouseId: 1, quantity: 6 }
        ])
      ).rejects.toThrow('Nedostatek zásob');

      const updated = await service.updateOrderItems(order.id, [
        { productId: 10, warehouseId: 1, quantity: 5 },
        { productId: 10, warehouseId: 1, quantity: 5 }
      ]);

      expect(updated.items).toHaveLength(1);
      expect(updated.items[0].quantity).toBe(10);
      expect(stockRepo.stocks.find((s) => s.warehouseId === 1)!.reservedQuantity).toBe(10);
    });

    it('měl by odmítnout editaci expedované nebo stornované objednávky', async () => {
      const shippedOrder = await createOrder([{ productId: 10, warehouseId: 1, quantity: 1 }]);
      await service.shipOrder(shippedOrder.id);
      await expect(
        service.updateOrderItems(shippedOrder.id, [{ productId: 10, warehouseId: 1, quantity: 1 }])
      ).rejects.toThrow('Expedovanou objednávku nelze editovat.');

      const cancelledOrder = await createOrder([{ productId: 10, warehouseId: 1, quantity: 1 }]);
      await service.cancelOrder(cancelledOrder.id, 'Test');
      await expect(
        service.updateOrderItems(cancelledOrder.id, [{ productId: 10, warehouseId: 1, quantity: 1 }])
      ).rejects.toThrow('Stornovanou objednávku nelze editovat.');
    });

    it('měl by odmítnout prázdné položky, neexistující produkt nebo sklad', async () => {
      const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 1 }]);

      await expect(service.updateOrderItems(order.id, [])).rejects.toThrow('alespoň jednu položku');
      await expect(
        service.updateOrderItems(order.id, [{ productId: 999, warehouseId: 1, quantity: 1 }])
      ).rejects.toThrow(NotFoundError);
      await expect(
        service.updateOrderItems(order.id, [{ productId: 10, warehouseId: 999, quantity: 1 }])
      ).rejects.toThrow(NotFoundError);
    });

    it('měl by odmítnout vyřazený produkt při editaci', async () => {
      const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 1 }]);
      stockRepo.stocks.push({
        id: 4,
        warehouseId: 1,
        productId: 20,
        physicalQuantity: 50,
        reservedQuantity: 0
      });

      await expect(
        service.updateOrderItems(order.id, [{ productId: 20, warehouseId: 1, quantity: 1 }])
      ).rejects.toThrow('Nelze objednat neaktivní produkt');
    });

    it('měl by při editaci zafixovat aktuální cenu z ceníku', async () => {
      const order = await createOrder([{ productId: 10, warehouseId: 1, quantity: 1 }]);
      productRepo.products[0].sellingPrice = 150;

      const updated = await service.updateOrderItems(order.id, [
        { productId: 10, warehouseId: 1, quantity: 1 }
      ]);

      expect(updated.items[0].unitPrice).toBe(150);
    });
  });
});
