import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MovementsPage } from './movements.page';
import { StockService } from '../../services/stock.service';
import { ProductService } from '../../services/product.service';
import { MovementFilter, StockMovement, Warehouse } from '../../models/stock.model';
import { Product } from '../../models/product.model';

const warehouses: Warehouse[] = [
  { id: 1, code: 'WH-HK', name: 'Centrální sklad Hradec Králové', address: 'Pospíšilova 312', isSeasonal: false },
  { id: 2, code: 'WH-TRB', name: 'Sezónní sklad (Garáž) Třebechovice', address: 'Pod Rybníkem 88', isSeasonal: true }
];

const movements: StockMovement[] = [
  {
    id: 1,
    productId: 1,
    warehouseId: 1,
    orderId: null,
    movementType: 'RECEIPT',
    quantityChange: 10,
    quantityAfter: 25,
    reason: 'Dodávka od truhláře',
    note: null,
    createdAt: '2026-11-19T10:00:00.000Z',
    product: { id: 1, code: 'KACA-BUK-01', name: 'Tradiční točivá káča buk' },
    warehouse: { id: 1, code: 'WH-HK', name: warehouses[0].name }
  },
  {
    id: 2,
    productId: 1,
    warehouseId: 2,
    orderId: 42,
    movementType: 'DISPATCH',
    quantityChange: -2,
    quantityAfter: 3,
    reason: 'Expedice objednávky ORD-1',
    note: null,
    createdAt: '2026-11-19T11:00:00.000Z',
    product: { id: 1, code: 'KACA-BUK-01', name: 'Tradiční točivá káča buk' },
    warehouse: { id: 2, code: 'WH-TRB', name: warehouses[1].name }
  }
];

class StockServiceStub {
  lastFilters: MovementFilter | undefined;

  getWarehouses = () => of({ success: true, data: warehouses });
  getMovements = (filters?: MovementFilter) => {
    this.lastFilters = filters;
    return of({ success: true, data: movements });
  };
}

class ProductServiceStub {
  getProducts = () => of({ success: true, data: [{ id: 1, code: 'KACA-BUK-01', name: 'Tradiční točivá káča buk' } as Product] });
}

describe('MovementsPage (auditní kniha)', () => {
  let stockStub: StockServiceStub;

  beforeEach(async () => {
    stockStub = new StockServiceStub();

    await TestBed.configureTestingModule({
      imports: [MovementsPage],
      providers: [
        { provide: StockService, useValue: stockStub },
        { provide: ProductService, useValue: new ProductServiceStub() }
      ]
    }).compileComponents();
  });

  const createPage = () => {
    const fixture = TestBed.createComponent(MovementsPage);
    fixture.detectChanges();
    return { fixture, page: fixture.componentInstance };
  };

  it('měl by vykreslit pohyby s českými názvy typů a barevnými odznaky', () => {
    const { fixture, page } = createPage();
    const rows = fixture.nativeElement.querySelectorAll('.movements-table tbody tr') as NodeListOf<HTMLElement>;

    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.movement-badge')?.textContent?.trim()).toBe('Příjem');
    expect(rows[0].querySelector('.movement-badge')?.classList).toContain('receipt');
    expect(rows[1].querySelector('.movement-badge')?.textContent?.trim()).toBe('Výdej');
    expect(rows[1].querySelector('.movement-badge')?.classList).toContain('dispatch');
    expect(page.typeLabel('INVENTORY_ADJUSTMENT')).toBe('Inventura');
    expect(page.badgeClass('TRANSFER_IN')).toBe('transfer');
  });

  it('měl by zvýraznit kladnou a zápornou změnu stavu', () => {
    const { page } = createPage();

    expect(page.filteredMovements[0].quantityChange).toBe(10);
    expect(page.filteredMovements[1].quantityChange).toBe(-2);
  });

  it('měl by fulltextem filtrovat podle produktu, skladu a důvodu', () => {
    const { page } = createPage();

    page.searchText = 'truhláře';
    expect(page.filteredMovements.map((m) => m.id)).toEqual([1]);

    page.searchText = 'garáž';
    expect(page.filteredMovements.map((m) => m.id)).toEqual([2]);

    page.searchText = 'kaca-buk';
    expect(page.filteredMovements).toHaveLength(2);
  });

  it('měl by filtry typu, skladu a produktu poslat do backendu', () => {
    const { page } = createPage();

    page.movementType = 'TRANSFER_OUT';
    page.warehouseId = 2;
    page.productId = 1;
    page.loadMovements();

    expect(stockStub.lastFilters).toEqual({
      productId: 1,
      warehouseId: 2,
      movementType: 'TRANSFER_OUT'
    });
  });

  it('měl by prázdné filtry poslat jako undefined', () => {
    const { page } = createPage();

    page.loadMovements();

    expect(stockStub.lastFilters).toEqual({
      productId: undefined,
      warehouseId: undefined,
      movementType: undefined
    });
  });
});
