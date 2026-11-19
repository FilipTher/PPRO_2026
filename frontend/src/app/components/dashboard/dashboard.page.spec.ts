import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DashboardPage } from './dashboard.page';
import { ReportService } from '../../services/report.service';
import { StockService } from '../../services/stock.service';
import { ProductService } from '../../services/product.service';
import { OrderService } from '../../services/order.service';
import { LowStockAlert, MonthlyCategoryRevenue } from '../../models/report.model';
import { ProductStockOverview, Warehouse } from '../../models/stock.model';
import { Product } from '../../models/product.model';
import { Order } from '../../models/order.model';

const warehouses: Warehouse[] = [
  { id: 1, code: 'WH-HK', name: 'Centrální sklad Hradec Králové', address: 'Pospíšilova 312', isSeasonal: false },
  { id: 2, code: 'WH-TRB', name: 'Sezónní sklad (Garáž) Třebechovice', address: 'Pod Rybníkem 88', isSeasonal: true }
];

const products = [
  {
    id: 1,
    code: 'KACA-BUK-01',
    name: 'Tradiční točivá káča buk',
    description: null,
    purchasePrice: 50,
    sellingPrice: 100,
    minStockLimit: 10,
    isActive: true,
    categories: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z'
  },
  {
    id: 2,
    code: 'JEZEK-KLEC-DREV',
    name: 'Dřevěný ježek v kleci',
    description: null,
    purchasePrice: 80,
    sellingPrice: 200,
    minStockLimit: 5,
    isActive: true,
    categories: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z'
  }
] as Product[];

const overview: ProductStockOverview[] = [
  {
    productId: 1,
    productCode: 'KACA-BUK-01',
    productName: products[0].name,
    minStockLimit: 10,
    stocks: [
      { warehouseId: 1, warehouseCode: 'WH-HK', warehouseName: warehouses[0].name, physicalQuantity: 15, reservedQuantity: 0, availableQuantity: 15 },
      { warehouseId: 2, warehouseCode: 'WH-TRB', warehouseName: warehouses[1].name, physicalQuantity: 5, reservedQuantity: 0, availableQuantity: 5 }
    ],
    totalPhysicalQuantity: 20,
    totalReservedQuantity: 0,
    totalAvailableQuantity: 20,
    isLowStock: false
  },
  {
    productId: 2,
    productCode: 'JEZEK-KLEC-DREV',
    productName: products[1].name,
    minStockLimit: 5,
    stocks: [
      { warehouseId: 1, warehouseCode: 'WH-HK', warehouseName: warehouses[0].name, physicalQuantity: 0, reservedQuantity: 0, availableQuantity: 0 },
      { warehouseId: 2, warehouseCode: 'WH-TRB', warehouseName: warehouses[1].name, physicalQuantity: 0, reservedQuantity: 0, availableQuantity: 0 }
    ],
    totalPhysicalQuantity: 0,
    totalReservedQuantity: 0,
    totalAvailableQuantity: 0,
    isLowStock: true
  }
];

const lowStock: LowStockAlert[] = [
  {
    productId: 2,
    productCode: 'JEZEK-KLEC-DREV',
    productName: products[1].name,
    totalPhysicalQuantity: 0,
    minStockLimit: 5,
    recommendedQuantity: 5,
    severity: 'CRITICAL'
  }
];

const report: MonthlyCategoryRevenue = {
  year: 2026,
  month: 11,
  periodFrom: '2026-11-01T00:00:00.000Z',
  periodTo: '2026-12-01T00:00:00.000Z',
  totalRevenue: 1000,
  totalQuantity: 10,
  categories: [
    { categoryId: 1, categoryName: 'Pro batolata', revenue: 1000, quantity: 10, revenueSharePercent: 100 },
    { categoryId: 2, categoryName: 'Dárky do 500 Kč', revenue: 600, quantity: 6, revenueSharePercent: 60 }
  ]
};

const orders = [
  { status: 'RESERVED' },
  { status: 'SHIPPED' },
  { status: 'CANCELLED' }
] as Order[];

class ReportServiceStub {
  alerts: LowStockAlert[] = lowStock;
  getLowStockAlerts = () => of({ success: true, data: this.alerts });
  getCategoryTurnover = () => of({ success: true, data: report });
}

class StockServiceStub {
  received: unknown[] = [];
  getStockOverview = () => of({ success: true, data: overview });
  getWarehouses = () => of({ success: true, data: warehouses });
  receiveStock = (dto: unknown) => {
    this.received.push(dto);
    return of({ success: true, data: {} });
  };
}

class ProductServiceStub {
  getProducts = () => of({ success: true, data: products });
}

class OrderServiceStub {
  getOrders = () => of({ success: true, data: orders });
}

describe('DashboardPage (dashboard)', () => {
  let reportStub: ReportServiceStub;
  let stockStub: StockServiceStub;

  beforeEach(async () => {
    reportStub = new ReportServiceStub();
    stockStub = new StockServiceStub();

    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        { provide: ReportService, useValue: reportStub },
        { provide: StockService, useValue: stockStub },
        { provide: ProductService, useValue: new ProductServiceStub() },
        { provide: OrderService, useValue: new OrderServiceStub() }
      ]
    }).compileComponents();
  });

  const createPage = () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    return { fixture, page: fixture.componentInstance };
  };

  it('měl by spočítat metriky skladu z reálných dat', () => {
    const { page } = createPage();

    // 20 ks x 50 = 1000 nákupní, 20 ks x 100 = 2000 prodejní
    expect(page.purchaseValue).toBe(1000);
    expect(page.sellingValue).toBe(2000);
    expect(page.piecesHk).toBe(15);
    expect(page.piecesTrb).toBe(5);
    expect(page.pendingOrders).toBe(1);
    expect(page.isLoading).toBe(false);
  });

  it('měl by zobrazit položky „co hoří“ s doporučeným množstvím', () => {
    const { fixture } = createPage();
    const rows = fixture.nativeElement.querySelectorAll('.alert-row') as NodeListOf<HTMLElement>;

    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('JEZEK-KLEC-DREV');
    expect(rows[0].textContent).toContain('Kritické');
    expect(rows[0].textContent).toContain('Naskladnit 5 ks');
  });

  it('měl by zobrazit obrat po kategoriích s progress bary', () => {
    const { fixture, page } = createPage();
    const rows = fixture.nativeElement.querySelectorAll('.revenue-row') as NodeListOf<HTMLElement>;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].textContent).toContain('Pro batolata');
    expect(rows[0].textContent).toContain('100 %');
    expect(page.barWidth(120)).toBe('100%');
    expect(page.barWidth(60)).toBe('60%');
  });

  it('měl by rychle naskladnit doporučené množství z alertu', () => {
    const { page } = createPage();

    page.openRestock(lowStock[0]);
    expect(page.restockQuantity).toBe(5);

    page.submitRestock();

    expect(stockStub.received).toEqual([
      {
        productId: 2,
        warehouseId: 1,
        quantity: 5,
        note: 'Rychlé naskladnění z dashboardu'
      }
    ]);
  });

  it('měl by při prázdném seznamu alertů ukázat, že je vše v pořádku', () => {
    reportStub.alerts = [];
    const { fixture } = createPage();

    expect(fixture.nativeElement.querySelectorAll('.alert-row').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Vše nad minimem');
  });
});
