import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OrdersPage } from './orders.page';
import { OrderService } from '../../services/order.service';
import { CustomerService } from '../../services/customer.service';
import { ProductService } from '../../services/product.service';
import { StockService } from '../../services/stock.service';
import { CreateOrderDto, Customer, Order, OrderStatus } from '../../models/order.model';
import { Product } from '../../models/product.model';
import { ProductStockOverview, Warehouse } from '../../models/stock.model';

const warehouses: Warehouse[] = [
  { id: 1, code: 'WH-HK', name: 'Centrální sklad Hradec Králové', address: 'Pospíšilova 312', isSeasonal: false },
  { id: 2, code: 'WH-TRB', name: 'Sezónní sklad (Garáž) Třebechovice', address: 'Pod Rybníkem 88', isSeasonal: true }
];

const customer: Customer = {
  id: 1,
  name: 'Jana Zákaznice',
  email: 'jana@example.com',
  phone: '+420 777 123 456',
  street: 'Dřevěná 12',
  city: 'Hradec Králové',
  zip: '500 02'
};

const product = {
  id: 1,
  code: 'KACA-BUK-01',
  name: 'Tradiční točivá káča buk',
  description: null,
  purchasePrice: 65,
  sellingPrice: 149,
  minStockLimit: 10,
  isActive: true,
  categories: [],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z'
} as Product;

const overview: ProductStockOverview[] = [
  {
    productId: 1,
    productCode: 'KACA-BUK-01',
    productName: product.name,
    minStockLimit: 10,
    stocks: [
      { warehouseId: 1, warehouseCode: 'WH-HK', warehouseName: warehouses[0].name, physicalQuantity: 15, reservedQuantity: 0, availableQuantity: 15 },
      { warehouseId: 2, warehouseCode: 'WH-TRB', warehouseName: warehouses[1].name, physicalQuantity: 5, reservedQuantity: 0, availableQuantity: 5 }
    ],
    totalPhysicalQuantity: 20,
    totalReservedQuantity: 0,
    totalAvailableQuantity: 20,
    isLowStock: false
  }
];

const order: Order = {
  id: 10,
  orderNumber: 'ORD-TEST-1',
  customerId: 1,
  status: 'RESERVED',
  createdAt: '2026-11-19T10:00:00.000Z',
  shippedAt: null,
  cancelReason: null,
  customer,
  items: [
    {
      id: 1,
      productId: 1,
      warehouseId: 1,
      quantity: 2,
      unitPrice: 149,
      product,
      warehouse: warehouses[0]
    }
  ]
};

class OrderServiceStub {
  lastStatus: OrderStatus | undefined;
  created: CreateOrderDto | null = null;
  shipped: number[] = [];
  cancelled: { id: number; reason: string }[] = [];

  getOrders = (status?: OrderStatus) => {
    this.lastStatus = status;
    return of({ success: true, data: [order] });
  };
  getOrderById = () => of({ success: true, data: order });
  createOrder = (dto: CreateOrderDto) => {
    this.created = dto;
    return of({ success: true, data: order });
  };
  shipOrder = (id: number) => {
    this.shipped.push(id);
    return of({ success: true, data: { ...order, status: 'SHIPPED' as OrderStatus } });
  };
  cancelOrder = (id: number, reason: string) => {
    this.cancelled.push({ id, reason });
    return of({ success: true, data: { ...order, status: 'CANCELLED' as OrderStatus } });
  };
}

class CustomerServiceStub {
  getCustomers = () => of({ success: true, data: [customer] });
}

class ProductServiceStub {
  getProducts = () => of({ success: true, data: [product] });
}

class StockServiceStub {
  getStockOverview = () => of({ success: true, data: overview });
  getWarehouses = () => of({ success: true, data: warehouses });
}

describe('OrdersPage (objednávky)', () => {
  let orderStub: OrderServiceStub;

  beforeEach(async () => {
    orderStub = new OrderServiceStub();

    await TestBed.configureTestingModule({
      imports: [OrdersPage],
      providers: [
        { provide: OrderService, useValue: orderStub },
        { provide: CustomerService, useValue: new CustomerServiceStub() },
        { provide: ProductService, useValue: new ProductServiceStub() },
        { provide: StockService, useValue: new StockServiceStub() }
      ]
    }).compileComponents();
  });

  const createPage = () => {
    const fixture = TestBed.createComponent(OrdersPage);
    fixture.detectChanges();
    return { fixture, page: fixture.componentInstance };
  };

  it('měl by vykreslit objednávky se stavem a celkovou cenou', () => {
    const { fixture } = createPage();
    const rows = fixture.nativeElement.querySelectorAll('.orders-table tbody tr') as NodeListOf<HTMLElement>;

    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('ORD-TEST-1');
    expect(rows[0].querySelector('.order-status')?.textContent?.trim()).toBe('K expedici');
    expect(rows[0].querySelector('.order-total')?.textContent).toContain('298');
  });

  it('měl by filtr stavu poslat do backendu', () => {
    const { page } = createPage();

    page.statusFilter = 'SHIPPED';
    page.loadOrders();

    expect(orderStub.lastStatus).toBe('SHIPPED');
  });

  it('měl by zablokovat uložení, když je množství větší než volné zásoby', () => {
    const { page } = createPage();

    page.openCreate();
    page.itemRows[0].quantity = 99;

    expect(page.rowError(page.itemRows[0])).toContain('volných pouze 15 ks');
    expect(page.createBlocked()).toBe(true);
  });

  it('měl by filtrovat zákazníky podle hledaného textu', () => {
    const { page } = createPage();

    page.openCreate();
    page.onCustomerSearch('jana@');
    expect(page.filteredCustomers.map((c) => c.id)).toEqual([1]);

    page.onCustomerSearch('neexistuje');
    expect(page.filteredCustomers).toHaveLength(0);
  });

  it('měl by odeslat objednávku s vybraným zákazníkem a položkami', () => {
    const { page } = createPage();

    page.openCreate();
    page.selectCustomer(customer);
    page.itemRows[0].quantity = 2;
    expect(page.createBlocked()).toBe(false);

    page.submitCreate();

    expect(orderStub.created).not.toBeNull();
    expect(orderStub.created?.customer.email).toBe('jana@example.com');
    expect(orderStub.created?.items).toEqual([
      { productId: 1, warehouseId: 1, quantity: 2 }
    ]);
  });

  it('měl by expedovat objednávku jedním kliknutím', () => {
    const { page } = createPage();

    page.ship(order);

    expect(orderStub.shipped).toEqual([10]);
  });

  it('měl by stornovat jen po zadání důvodu', () => {
    const { page } = createPage();
    const originalPrompt = window.prompt;

    window.prompt = () => '';
    page.cancel(order);
    expect(orderStub.cancelled).toHaveLength(0);

    window.prompt = () => 'Zákazník nezaplatil';
    page.cancel(order);
    expect(orderStub.cancelled).toEqual([{ id: 10, reason: 'Zákazník nezaplatil' }]);

    window.prompt = originalPrompt;
  });
});
