import { IOrderRepository } from '../repositories/order.repository';
import { ICustomerRepository } from '../repositories/customer.repository';
import { IProductRepository } from '../repositories/product.repository';
import { IStockRepository } from '../repositories/stock.repository';
import {
  CreateOrderDto,
  CreateOrderItemDto,
  CreateOrderItemInputDto,
  CreateCustomerDto,
  OrderWithRelations
} from '../types/order.types';
import { DomainValidationError, NotFoundError } from '../errors';

type PreparedItem = CreateOrderItemDto & { productName: string };

export class OrderService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly productRepository: IProductRepository,
    private readonly stockRepository: IStockRepository
  ) {}

  /**
   * Založí objednávku s okamžitou rezervací zásob.
   * Položky mohou být z různých skladů (každá má vlastní warehouseId).
   * Vynucuje: neprázdné položky, kladná celá množství, existující aktivní produkty,
   * dostatek VOLNÝCH zásob (fyzický - rezervovaný) na daném skladu.
   * Zajišťuje: rezervaci v jedné transakci, stav RESERVED a zafixování ceny z ceníku.
   */
  async createOrder(dto: CreateOrderDto): Promise<OrderWithRelations> {
    this.validateCustomer(dto.customer);

    const preparedItems = await this.prepareItems(dto.items);

    // Rychlé odmítnutí dřív, než vznikne zákazník nebo objednávka
    await this.assertAvailable(this.stockRepository, preparedItems);

    const customer = await this.customerRepository.findOrCreate(dto.customer);

    // Atomicky: rezervace všech položek + založení objednávky
    return this.orderRepository.executeInTransaction(async (orders, stocks) => {
      // Kontrola znovu uvnitř transakce (mezi ověřením a zápisem mohl vzniknout jiný požadavek)
      await this.assertAvailable(stocks, preparedItems);
      await this.reserveItems(stocks, preparedItems);

      return orders.createOrderWithItems({
        orderNumber: generateOrderNumber(),
        customerId: customer.id,
        status: 'RESERVED',
        items: preparedItems
      });
    });
  }

  /**
   * Expedice objednávky: fyzický odpis ze skladu, uvolnění rezervace
   * a auditní pohyb DISPATCH pro každou položku. Pouze z stavu RESERVED.
   */
  async shipOrder(orderId: number): Promise<OrderWithRelations> {
    const order = await this.orderRepository.findOrderById(orderId);
    if (!order) {
      throw new NotFoundError(`Objednávka s ID ${orderId} nebyla nalezena.`);
    }
    if (order.status !== 'RESERVED') {
      throw new DomainValidationError('Expedicovat lze pouze objednávku ve stavu RESERVED.');
    }

    return this.orderRepository.executeInTransaction(async (orders, stocks) => {
      // Stav se ověřuje znovu uvnitř transakce (mohl mezitím vzniknout jiný požadavek)
      const current = await orders.findOrderById(orderId);
      if (!current) {
        throw new NotFoundError(`Objednávka s ID ${orderId} nebyla nalezena.`);
      }
      if (current.status !== 'RESERVED') {
        throw new DomainValidationError('Expedicovat lze pouze objednávku ve stavu RESERVED.');
      }

      for (const item of current.items) {
        const stock = await stocks.findStock(item.warehouseId, item.productId);
        const physical = stock ? stock.physicalQuantity : 0;
        const reserved = stock ? stock.reservedQuantity : 0;

        if (reserved < item.quantity || physical < item.quantity) {
          throw new DomainValidationError(
            `Nelze expedovat: na skladě chybí rezervované kusy produktu '${item.product.name}'.`
          );
        }

        const updated = await stocks.updateStockQuantities(item.warehouseId, item.productId, {
          physicalQuantity: physical - item.quantity,
          reservedQuantity: reserved - item.quantity
        });

        await stocks.recordMovement({
          productId: item.productId,
          warehouseId: item.warehouseId,
          orderId: current.id,
          movementType: 'DISPATCH',
          quantityChange: -item.quantity,
          quantityAfter: updated.physicalQuantity,
          reason: `Expedice objednávky ${current.orderNumber}`
        });
      }

      return orders.updateOrderStatus(orderId, 'SHIPPED', new Date());
    });
  }

  /**
   * Storno objednávky: uvolnění rezervací bez fyzického odpisu.
   * Expedovanou objednávku stornovat nelze (řeší se vratkou/reklamací).
   */
  async cancelOrder(orderId: number, reason: string): Promise<OrderWithRelations> {
    if (!reason || reason.trim().length === 0) {
      throw new DomainValidationError('Důvod storna je povinný.');
    }

    const order = await this.orderRepository.findOrderById(orderId);
    if (!order) {
      throw new NotFoundError(`Objednávka s ID ${orderId} nebyla nalezena.`);
    }
    this.assertCancellable(order.status);

    // shortcut: důvod storna se zatím neukládá – Order nemá pole pro poznámku,
    // doplnit až s modulem vratek/reklamací.
    return this.orderRepository.executeInTransaction(async (orders, stocks) => {
      const current = await orders.findOrderById(orderId);
      if (!current) {
        throw new NotFoundError(`Objednávka s ID ${orderId} nebyla nalezena.`);
      }
      this.assertCancellable(current.status);

      if (current.status === 'RESERVED') {
        for (const item of current.items) {
          const stock = await stocks.findStock(item.warehouseId, item.productId);
          const reserved = stock ? stock.reservedQuantity : 0;

          await stocks.updateStockQuantities(item.warehouseId, item.productId, {
            reservedQuantity: Math.max(0, reserved - item.quantity)
          });
        }
      }

      return orders.updateOrderStatus(orderId, 'CANCELLED');
    });
  }

  /**
   * Editace položek před expedicí (ADR-007).
   * Atomický přepočet: staré rezervace se uvolní, ověří se disponibilita
   * pro nové položky a založí se nové rezervace. Cena se fixuje z aktuálního ceníku.
   */
  async updateOrderItems(
    orderId: number,
    items: CreateOrderItemInputDto[]
  ): Promise<OrderWithRelations> {
    const order = await this.orderRepository.findOrderById(orderId);
    if (!order) {
      throw new NotFoundError(`Objednávka s ID ${orderId} nebyla nalezena.`);
    }
    this.assertEditable(order.status);

    const preparedItems = await this.prepareItems(items);

    return this.orderRepository.executeInTransaction(async (orders, stocks) => {
      const current = await orders.findOrderById(orderId);
      if (!current) {
        throw new NotFoundError(`Objednávka s ID ${orderId} nebyla nalezena.`);
      }
      this.assertEditable(current.status);

      // 1. Vrátit rezervace původních položek (uvolní i kusy, které nová verze použije znovu)
      for (const item of current.items) {
        const stock = await stocks.findStock(item.warehouseId, item.productId);
        const reserved = stock ? stock.reservedQuantity : 0;

        await stocks.updateStockQuantities(item.warehouseId, item.productId, {
          reservedQuantity: Math.max(0, reserved - item.quantity)
        });
      }

      // 2. Ověřit disponibilitu pro nové položky až po uvolnění starých rezervací
      await this.assertAvailable(stocks, preparedItems);

      // 3. Založit nové rezervace a nahradit položky objednávky
      await this.reserveItems(stocks, preparedItems);
      return orders.updateOrderItems(orderId, preparedItems);
    });
  }

  private assertEditable(status: string): void {
    if (status === 'SHIPPED') {
      throw new DomainValidationError('Expedovanou objednávku nelze editovat.');
    }
    if (status === 'CANCELLED') {
      throw new DomainValidationError('Stornovanou objednávku nelze editovat.');
    }
    if (status !== 'RESERVED') {
      throw new DomainValidationError('Editovat lze pouze rezervovanou objednávku.');
    }
  }

  private assertCancellable(status: string): void {
    if (status === 'SHIPPED') {
      throw new DomainValidationError('Expedovanou objednávku nelze stornovat (řeší se vratkou/reklamací).');
    }
    if (status === 'CANCELLED') {
      throw new DomainValidationError('Objednávka je již stornována.');
    }
  }

  /**
   * Validace položek, sloučení duplicit (produkt + sklad) a fixace cen z ceníku.
   */
  private async prepareItems(items: CreateOrderItemInputDto[]): Promise<PreparedItem[]> {
    if (!items || items.length === 0) {
      throw new DomainValidationError('Objednávka musí obsahovat alespoň jednu položku.');
    }

    for (const item of items) {
      if (!Number.isInteger(item.productId) || item.productId <= 0) {
        throw new DomainValidationError('ID produktu musí být kladné celé číslo.');
      }
      if (!Number.isInteger(item.warehouseId) || item.warehouseId <= 0) {
        throw new DomainValidationError('ID skladu musí být kladné celé číslo.');
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new DomainValidationError('Množství položky musí být kladné celé číslo.');
      }
    }

    // Sloučení duplicitních dvojic produkt + sklad, aby se tatáž zásoba
    // neověřovala dvakrát (jinak by šlo rezervovat víc, než je k dispozici)
    const aggregated = new Map<string, { productId: number; warehouseId: number; quantity: number }>();
    for (const item of items) {
      const key = `${item.productId}_${item.warehouseId}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        aggregated.set(key, {
          productId: item.productId,
          warehouseId: item.warehouseId,
          quantity: item.quantity
        });
      }
    }

    const preparedItems: PreparedItem[] = [];
    for (const item of aggregated.values()) {
      const product = await this.productRepository.findById(item.productId);
      if (!product) {
        throw new NotFoundError(`Produkt s ID ${item.productId} nebyl nalezen.`);
      }
      if (!product.isActive) {
        throw new DomainValidationError(`Nelze objednat neaktivní produkt '${product.name}'.`);
      }

      preparedItems.push({
        productId: item.productId,
        warehouseId: item.warehouseId,
        quantity: item.quantity,
        unitPrice: product.sellingPrice,
        productName: product.name
      });
    }

    return preparedItems;
  }

  /**
   * Navýší rezervace všech položek na příslušných skladech.
   */
  private async reserveItems(stockRepo: IStockRepository, items: PreparedItem[]): Promise<void> {
    for (const item of items) {
      const stock = await stockRepo.findStock(item.warehouseId, item.productId);
      const currentReserved = stock ? stock.reservedQuantity : 0;

      await stockRepo.updateStockQuantities(item.warehouseId, item.productId, {
        reservedQuantity: currentReserved + item.quantity
      });
    }
  }

  /**
   * Ověří dostatek volných zásob a existenci skladů pro všechny položky.
   * Volá se před transakcí i uvnitř ní.
   */
  private async assertAvailable(stockRepo: IStockRepository, items: PreparedItem[]): Promise<void> {
    for (const item of items) {
      const warehouse = await stockRepo.findWarehouseById(item.warehouseId);
      if (!warehouse) {
        throw new NotFoundError(`Sklad s ID ${item.warehouseId} nebyl nalezen.`);
      }

      const stock = await stockRepo.findStock(item.warehouseId, item.productId);
      const physical = stock ? stock.physicalQuantity : 0;
      const reserved = stock ? stock.reservedQuantity : 0;
      const available = physical - reserved;

      if (item.quantity > available) {
        throw new DomainValidationError(
          `Nedostatek zásob: Produkt ${item.productName} má na skladě ${physical} ks, volných pouze ${available} ks.`
        );
      }
    }
  }

  private validateCustomer(customer: CreateCustomerDto): void {
    if (!customer || !customer.name || customer.name.trim().length === 0) {
      throw new DomainValidationError('Jméno zákazníka je povinné.');
    }
    if (!customer.email || !/^\S+@\S+\.\S+$/.test(customer.email.trim())) {
      throw new DomainValidationError('E-mail zákazníka není platný.');
    }
  }
}

function generateOrderNumber(): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${Date.now()}-${suffix}`;
}
