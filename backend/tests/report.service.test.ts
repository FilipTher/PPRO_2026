import { describe, it, expect, beforeEach } from '@jest/globals';
import { ReportService } from '../src/services/report.service';
import { IReportRepository } from '../src/repositories/report.repository';
import { ShippedRevenueSummary } from '../src/types/report.types';
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

describe('ReportService (měsíční obrat po kategoriích)', () => {
  let repository: MockReportRepository;
  let service: ReportService;

  beforeEach(() => {
    repository = new MockReportRepository();
    service = new ReportService(repository);
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
});
