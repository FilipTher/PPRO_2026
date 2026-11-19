import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ReportsPage } from './reports.page';
import { ReportService } from '../../services/report.service';
import { LowStockAlert, MonthlyCategoryRevenue } from '../../models/report.model';

const report: MonthlyCategoryRevenue = {
  year: 2026,
  month: 11,
  periodFrom: '2026-11-01T00:00:00.000Z',
  periodTo: '2026-12-01T00:00:00.000Z',
  totalRevenue: 616,
  totalQuantity: 4,
  categories: [
    { categoryId: 1, categoryName: 'Pro batolata', revenue: 398, quantity: 2, revenueSharePercent: 64.6 },
    { categoryId: 2, categoryName: 'Dárky do 500 Kč', revenue: 218, quantity: 2, revenueSharePercent: 35.4 }
  ]
};

const lowStock: LowStockAlert[] = [
  {
    productId: 2,
    productCode: 'KACA-MODRA',
    productName: 'Točivá káča modrá',
    totalPhysicalQuantity: 2,
    minStockLimit: 10,
    recommendedQuantity: 8,
    severity: 'CRITICAL'
  },
  {
    productId: 3,
    productCode: 'KACA-CERVENA',
    productName: 'Točivá káča červená',
    totalPhysicalQuantity: 9,
    minStockLimit: 10,
    recommendedQuantity: 1,
    severity: 'WARNING'
  }
];

class ReportServiceStub {
  lastCall: { year: number; month: number } | null = null;
  turnover: MonthlyCategoryRevenue = report;
  alerts: LowStockAlert[] = lowStock;

  getCategoryTurnover(year: number, month: number) {
    this.lastCall = { year, month };
    return of({ success: true, data: this.turnover });
  }

  getLowStockAlerts() {
    return of({ success: true, data: this.alerts });
  }
}

describe('ReportsPage (reporty)', () => {
  let stub: ReportServiceStub;

  beforeEach(async () => {
    stub = new ReportServiceStub();

    await TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [{ provide: ReportService, useValue: stub }]
    }).compileComponents();
  });

  const createPage = () => {
    const fixture = TestBed.createComponent(ReportsPage);
    fixture.detectChanges();
    return { fixture, page: fixture.componentInstance };
  };

  it('měl by vykreslit souhrn, obrat po kategoriích a položky pod minimem', () => {
    const { fixture, page } = createPage();
    const text = fixture.nativeElement.textContent;

    expect(page.report?.totalRevenue).toBe(616);
    expect(page.categoryCount).toBe(2);
    expect(page.lowStock).toHaveLength(2);
    expect(text).toContain('Pro batolata');
    expect(text).toContain('398');
    expect(text).toContain('KACA-MODRA');
    expect(text).toContain('Kritické');
    expect(text).toContain('Varování');
  });

  it('měl by při přechodu na předchozí měsíc načíst správné období', () => {
    const { page } = createPage();
    page.year = 2026;
    page.month = 1;

    page.previousMonth();

    expect(stub.lastCall).toEqual({ year: 2025, month: 12 });
    expect(page.monthLabel).toBe('prosinec 2025');
  });

  it('měl by při přechodu na další měsíc přelít rok', () => {
    const { page } = createPage();
    page.year = 2026;
    page.month = 12;

    page.nextMonth();

    expect(stub.lastCall).toEqual({ year: 2027, month: 1 });
    expect(page.monthLabel).toBe('leden 2027');
  });

  it('měl by zobrazit prázdný stav pro měsíc bez expedic', () => {
    stub.turnover = { ...report, totalRevenue: 0, totalQuantity: 0, categories: [] };
    const { fixture } = createPage();

    expect(fixture.nativeElement.textContent).toContain('nejsou expedované žádné objednávky');
  });

  it('měl by omezit šířku pruhu podílu na 100 %', () => {
    const { page } = createPage();
    const category = { ...report.categories[0], revenueSharePercent: 140 };

    expect(page.shareWidth(category)).toBe('100%');
    expect(page.shareWidth(report.categories[1])).toBe('35.4%');
  });
});
