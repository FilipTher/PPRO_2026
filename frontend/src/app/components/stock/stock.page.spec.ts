import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StockPage } from './stock.page';
import { StockService } from '../../services/stock.service';
import { ProductStockOverview, ReceiveStockDto, TransferStockDto, Warehouse } from '../../models/stock.model';

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
  }
];

class StockServiceStub {
  received: ReceiveStockDto[] = [];
  transferred: TransferStockDto[] = [];

  getStockOverview = () => of({ success: true, data: overview });
  getWarehouses = () => of({ success: true, data: warehouses });
  receiveStock = (dto: ReceiveStockDto) => {
    this.received.push(dto);
    return of({ success: true, data: {} });
  };
  transferStock = (dto: TransferStockDto) => {
    this.transferred.push(dto);
    return of({ success: true, data: {} });
  };
}

describe('StockPage (příjem a přesun)', () => {
  let stub: StockServiceStub;

  beforeEach(async () => {
    stub = new StockServiceStub();

    await TestBed.configureTestingModule({
      imports: [StockPage],
      providers: [{ provide: StockService, useValue: stub }]
    }).compileComponents();
  });

  it('měl by vykreslit tabulku zásob s akčními tlačítky', async () => {
    const fixture = TestBed.createComponent(StockPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const rows = fixture.nativeElement.querySelectorAll('.stock-table tbody tr');
    expect(rows.length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.btn-row').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('KACA-BUK-01');
  });

  it('měl by naskladnit zadané množství na vybraný sklad', () => {
    const fixture = TestBed.createComponent(StockPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();

    page.openReceipt(overview[0]);
    expect(page.receiptWarehouseId).toBe(1);

    page.receiptQuantity = 4;
    page.receiptNote = 'Dodávka od truhláře';
    page.submitReceipt();

    expect(stub.received).toEqual([
      { productId: 1, warehouseId: 1, quantity: 4, note: 'Dodávka od truhláře' }
    ]);
  });

  it('měl by odmítnout přesun na stejný sklad bez volání backendu', () => {
    const fixture = TestBed.createComponent(StockPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();

    page.openTransfer(overview[0]);
    page.transferTargetWarehouseId = page.transferSourceId;
    page.submitTransfer();

    expect(page.transferError).toContain('nesmí být stejný');
    expect(stub.transferred).toHaveLength(0);
  });

  it('měl by odmítnout přesun větší, než je volných kusů', () => {
    const fixture = TestBed.createComponent(StockPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();

    page.openTransfer(overview[0]);
    page.transferQuantity = 99;
    page.submitTransfer();

    expect(page.transferError).toContain('volných pouze 15 ks');
    expect(stub.transferred).toHaveLength(0);
  });

  it('měl by přesunout volné kusy mezi sklady', () => {
    const fixture = TestBed.createComponent(StockPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();

    page.openTransfer(overview[0]);
    page.transferQuantity = 2;
    page.transferNote = 'Zimní zásoby';
    page.submitTransfer();

    expect(stub.transferred).toEqual([
      {
        productId: 1,
        sourceWarehouseId: 1,
        targetWarehouseId: 2,
        quantity: 2,
        note: 'Zimní zásoby'
      }
    ]);
  });
});
