import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { InventoryPage } from './inventory.page';
import { StockService } from '../../services/stock.service';
import { InventoryAdjustmentDto, ProductStockOverview, Warehouse } from '../../models/stock.model';

const warehouses: Warehouse[] = [
  { id: 1, code: 'WH-HK', name: 'Centrální sklad Hradec Králové', address: 'Pospíšilova 312', isSeasonal: false },
  { id: 2, code: 'WH-TRB', name: 'Sezónní sklad (Garáž) Třebechovice', address: 'Pod Rybníkem 88', isSeasonal: true }
];

const overview: ProductStockOverview[] = [
  {
    productId: 1,
    productCode: 'KACA-BUK-01',
    productName: 'Tradiční točivá káča buk',
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
    productName: 'Dřevěný ježek v kleci',
    minStockLimit: 6,
    stocks: [
      { warehouseId: 1, warehouseCode: 'WH-HK', warehouseName: warehouses[0].name, physicalQuantity: 3, reservedQuantity: 0, availableQuantity: 3 },
      { warehouseId: 2, warehouseCode: 'WH-TRB', warehouseName: warehouses[1].name, physicalQuantity: 5, reservedQuantity: 0, availableQuantity: 5 }
    ],
    totalPhysicalQuantity: 8,
    totalReservedQuantity: 0,
    totalAvailableQuantity: 8,
    isLowStock: false
  }
];

class StockServiceStub {
  reconciled: InventoryAdjustmentDto[] = [];

  getStockOverview = () => of({ success: true, data: overview });
  getWarehouses = () => of({ success: true, data: warehouses });
  reconcileInventory = (dto: InventoryAdjustmentDto) => {
    this.reconciled.push(dto);
    return of({ success: true, data: {} });
  };
}

describe('InventoryPage (inventura)', () => {
  let stub: StockServiceStub;

  beforeEach(async () => {
    stub = new StockServiceStub();

    await TestBed.configureTestingModule({
      imports: [InventoryPage],
      providers: [{ provide: StockService, useValue: stub }]
    }).compileComponents();
  });

  const createPage = () => {
    const fixture = TestBed.createComponent(InventoryPage);
    fixture.detectChanges();
    return { fixture, page: fixture.componentInstance };
  };

  it('měl by načíst řádky pro výchozí sklad s aktuálním stavem', () => {
    const { page } = createPage();

    expect(page.selectedWarehouseId).toBe(1);
    expect(page.rows).toHaveLength(2);
    expect(page.rows[0].currentPhysical).toBe(15);
    expect(page.rows[1].currentPhysical).toBe(3);
  });

  it('měl by ihned počítat rozdíl (přebytek, manko, shoda)', () => {
    const { page } = createPage();
    const [first, second] = page.rows;

    first.counted = 17;
    second.counted = 1;
    expect(page.difference(first)).toBe(2);
    expect(page.differenceClass(first)).toBe('diff-positive');
    expect(page.differenceLabel(first)).toContain('Přebytek +2');

    expect(page.difference(second)).toBe(-2);
    expect(page.differenceClass(second)).toBe('diff-negative');
    expect(page.differenceLabel(second)).toContain('Manko -2');

    first.counted = 15;
    expect(page.difference(first)).toBe(0);
    expect(page.differenceClass(first)).toBe('diff-zero');
  });

  it('měl by vyžadovat důvod, když existuje rozdíl', () => {
    const { page } = createPage();
    page.rows[0].counted = 16;

    page.submit();

    expect(page.errorMessage).toContain('Důvod inventurního rozdílu je povinný');
    expect(stub.reconciled).toHaveLength(0);
  });

  it('měl by odmítnout záporný napočítaný stav', () => {
    const { page } = createPage();
    page.rows[0].counted = -1;
    page.reason = 'Test';

    page.submit();

    expect(page.errorMessage).toContain('nezáporné celé číslo');
    expect(stub.reconciled).toHaveLength(0);
  });

  it('měl by uložit jen položky s odchylkou včetně důvodu', () => {
    const { page } = createPage();
    page.rows[0].counted = 16; // +1
    page.rows[1].counted = 3; // beze změny
    page.reason = 'Manko při inventuře garáže';

    page.submit();

    expect(stub.reconciled).toEqual([
      {
        productId: 1,
        warehouseId: 1,
        actualPhysicalQuantity: 16,
        reason: 'Manko při inventuře garáže'
      }
    ]);
  });
});
