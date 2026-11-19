import { describe, it, expect, beforeEach } from '@jest/globals';
import { ReportService } from '../src/services/report.service';
import { StockService } from '../src/services/stock.service';
import { IReportRepository } from '../src/repositories/report.repository';
import { ProductStockOverviewDto, ShippedRevenueSummary } from '../src/types';
import { DomainValidationError } from '../src/errors';

class MockReportRepository implements IReportRepository {
  summary: ShippedRevenueSummary = { totalRevenue: 0, totalQuantity: 0, categories: [] };
  lastFrom?: Date;
  lastTo?: Date;

  async getShippedRevenue(from: Date, to: Date): Promise<ShippedRevenueSummary> {
    this.lastFrom = from;
    this.lastTo = to;
    return this.summary;
  }
}

class MockStockService {
  overview: ProductStockOverviewDto[] = [];

  async getStockOverview(): Promise<ProductStockOverviewDto[]> {
    return this.overview;
  }
}

describe('ReportService (měsíční obrat po kategoriích)', () => {
  let repository: MockReportRepository;
  let stockService: MockStockService;
  let service: ReportService;

  beforeEach(() => {
    repository = new MockReportRepository();
    stockService = new MockStockService();
    service = new ReportService(repository, stockService as unknown as StockService);
  });

  it('měl by spočítat podíl kategorií na celkových tržbách a seřadit je od nejvyšší', async () => {
    repository.summary = {
      totalRevenue: 1000,
      totalQuantity: 15,
      categories: [
        { categoryId: 2, categoryName: 'Dárky do 500 Kč', revenue: 300, quantity: 5 },
        { categoryId: 1, categoryName: 'Pro batolata', revenue: 600, quantity: 10 }
      ]
    };

    const report = await service.getMonthlyCategoryRevenue(2026, 11);

    expect(report.totalRevenue).toBe(1000);
    expect(report.totalQuantity).toBe(15);
    expect(report.categories.map((c) => c.categoryName)).toEqual([
      'Pro batolata',
      'Dárky do 500 Kč'
    ]);
    expect(report.categories[0].revenueSharePercent).toBe(60);
    expect(report.categories[1].revenueSharePercent).toBe(30);
  });

  it('měl by pro zadaný měsíc použít správný rozsah od prvního dne do prvního dne dalšího měsíce', async () => {
    await service.getMonthlyCategoryRevenue(2026, 2);

    expect(repository.lastFrom?.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(repository.lastTo?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('měl by zaokrouhlit tržby na haléře', async () => {
    repository.summary = {
      totalRevenue: 10.006,
      totalQuantity: 1,
      categories: [{ categoryId: 1, categoryName: 'Pro batolata', revenue: 10.006, quantity: 1 }]
    };

    const report = await service.getMonthlyCategoryRevenue(2026, 11);

    expect(report.totalRevenue).toBe(10.01);
    expect(report.categories[0].revenue).toBe(10.01);
  });

  it('měl by při nulových tržbách vrátit nulové podíly (bez dělení nulou)', async () => {
    repository.summary = {
      totalRevenue: 0,
      totalQuantity: 0,
      categories: [{ categoryId: 1, categoryName: 'Pro batolata', revenue: 0, quantity: 0 }]
    };

    const report = await service.getMonthlyCategoryRevenue(2026, 11);

    expect(report.totalRevenue).toBe(0);
    expect(report.categories[0].revenueSharePercent).toBe(0);
    expect(Number.isNaN(report.categories[0].revenueSharePercent)).toBe(false);
  });

  it('měl by odmítnout neplatný měsíc a rok', async () => {
    for (const month of [0, 13, 1.5, -1]) {
      await expect(service.getMonthlyCategoryRevenue(2026, month)).rejects.toThrow(
        DomainValidationError
      );
    }

    for (const year of [1999, 2101, 2026.5]) {
      await expect(service.getMonthlyCategoryRevenue(year, 11)).rejects.toThrow(
        DomainValidationError
      );
    }
  });

  describe('getLowStockAlerts (co hoří)', () => {
    const stockDetail = (
      warehouseId: number,
      warehouseCode: string,
      physicalQuantity: number
    ) => ({
      warehouseId,
      warehouseCode,
      warehouseName: warehouseId === 1 ? 'Centrální sklad Hradec Králové' : 'Sezónní garáž Třebechovice',
      physicalQuantity,
      reservedQuantity: 0,
      availableQuantity: physicalQuantity
    });

    const overviewItem = (
      productId: number,
      productCode: string,
      physical: number,
      minStockLimit: number
    ): ProductStockOverviewDto => ({
      productId,
      productCode,
      productName: `Produkt ${productCode}`,
      minStockLimit,
      stocks: [stockDetail(1, 'WH-HK', physical)],
      totalPhysicalQuantity: physical,
      totalReservedQuantity: 0,
      totalAvailableQuantity: physical,
      isLowStock: physical <= minStockLimit
    });

    it('měl by vrátit jen produkty na minimu nebo pod ním, kritické první', async () => {
      stockService.overview = [
        overviewItem(1, 'WARN-01', 8, 10),
        overviewItem(2, 'OK-01', 50, 10),
        overviewItem(3, 'CRIT-01', 0, 10)
      ];

      const alerts = await service.getLowStockAlerts();

      expect(alerts).toHaveLength(2);
      expect(alerts[0].productCode).toBe('CRIT-01');
      expect(alerts[0].severity).toBe('CRITICAL');
      expect(alerts[1].productCode).toBe('WARN-01');
      expect(alerts[1].severity).toBe('WARNING');
    });

    it('měl by spočítat doporučené množství k doplnění minima', async () => {
      stockService.overview = [
        overviewItem(1, 'LOW-01', 3, 10),
        overviewItem(2, 'ZERO-01', 0, 10),
        overviewItem(3, 'EDGE-01', 10, 10)
      ];

      const alerts = await service.getLowStockAlerts();
      const byCode = Object.fromEntries(alerts.map((a) => [a.productCode, a]));

      expect(byCode['LOW-01'].recommendedQuantity).toBe(7);
      expect(byCode['ZERO-01'].recommendedQuantity).toBe(10);
      // na přesném minimu se doporučuje alespoň 1 kus
      expect(byCode['EDGE-01'].recommendedQuantity).toBe(1);
      expect(byCode['EDGE-01'].severity).toBe('WARNING');
    });

    it('měl by předat rozpad zásob po skladech', async () => {
      stockService.overview = [
        {
          ...overviewItem(1, 'CRIT-01', 0, 5),
          stocks: [stockDetail(1, 'WH-HK', 0), stockDetail(2, 'WH-TRB', 0)]
        }
      ];

      const alerts = await service.getLowStockAlerts();

      expect(alerts[0].stocks).toHaveLength(2);
      expect(alerts[0].stocks.map((s) => s.warehouseCode)).toEqual(['WH-HK', 'WH-TRB']);
    });

    it('měl by vrátit prázdný seznam, když je vše nad minimem', async () => {
      stockService.overview = [overviewItem(1, 'OK-01', 50, 10)];

      await expect(service.getLowStockAlerts()).resolves.toEqual([]);
    });
  });
});
