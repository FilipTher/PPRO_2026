import { IOrderRepository } from '../repositories/order.repository';
import { ICustomerRepository } from '../repositories/customer.repository';
import { IProductRepository } from '../repositories/product.repository';
import { IStockRepository } from '../repositories/stock.repository';
import {
  CreateOrderDto,
  CreateOrderItemDto,
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
   * Vynucuje: neprázdné položky, kladná celá množství, existující aktivní produkty,
   * dostatek VOLNÝCH zásob (fyzický - rezervovaný) na daném skladu.
   * Zajišťuje: rezervaci v jedné transakci, stav RESERVED a zafixování ceny z ceníku.
   */
  async createOrder(dto: CreateOrderDto): Promise<OrderWithRelations> {
    // 1. Validace vstupu
    this.validateCustomer(dto.customer);

    if (!dto.items || dto.items.length === 0) {
      throw new DomainValidationError('Objednávka musí obsahovat alespoň jednu položku.');
    }

    for (const item of dto.items) {
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

    // 2. Sloučení duplicitních dvojic produkt + sklad, aby se tatáž zásoba
    //    neověřovala dvakrát (jinak by šlo rezervovat víc, než je k dispozici)
    const aggregated = new Map<string, { productId: number; warehouseId: number; quantity: number }>();
    for (const item of dto.items) {
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

    // 3. Existence a aktivita produktů + fixace ceny z aktuálního ceníku
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

    // 4. Rychlé odmítnutí dřív, než vznikne zákazník nebo objednávka
    await this.assertAvailable(this.stockRepository, preparedItems);

    const customer = await this.customerRepository.findOrCreate(dto.customer);

    // 5. Atomicky: rezervace všech položek + založení objednávky
    return this.orderRepository.executeInTransaction(async (orders, stocks) => {
      // Kontrola znovu uvnitř transakce (mezi ověřením a zápisem mohl vzniknout jiný požadavek)
      await this.assertAvailable(stocks, preparedItems);

      for (const item of preparedItems) {
        const stock = await stocks.findStock(item.warehouseId, item.productId);
        const currentReserved = stock ? stock.reservedQuantity : 0;

        await stocks.updateStockQuantities(item.warehouseId, item.productId, {
          reservedQuantity: currentReserved + item.quantity
        });
      }

      return orders.createOrderWithItems({
        orderNumber: generateOrderNumber(),
        customerId: customer.id,
        status: 'RESERVED',
        items: preparedItems
      });
    });
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
