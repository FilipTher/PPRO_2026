import { IReportRepository } from '../repositories/report.repository';
import { MonthlyCategoryRevenueDto } from '../types/report.types';
import { DomainValidationError } from '../errors';

export class ReportService {
  constructor(private readonly reportRepository: IReportRepository) {}

  /**
   * Měsíční obrat po kategoriích.
   * Do obratu vstupují výhradně expedované objednávky (SHIPPED) se zafixovanými
   * cenami položek; měsíc se určuje podle data expedice.
   */
  async getMonthlyCategoryRevenue(year: number, month: number): Promise<MonthlyCategoryRevenueDto> {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new DomainValidationError('Rok musí být celé číslo v rozsahu 2000 až 2100.');
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new DomainValidationError('Měsíc musí být celé číslo 1 až 12.');
    }

    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));

    const summary = await this.reportRepository.getShippedRevenue(from, to);
    const totalRevenue = round2(summary.totalRevenue);

    return {
      year,
      month,
      periodFrom: from.toISOString(),
      periodTo: to.toISOString(),
      totalRevenue,
      totalQuantity: summary.totalQuantity,
      categories: summary.categories
        .map((category) => ({
          ...category,
          revenue: round2(category.revenue),
          revenueSharePercent:
            totalRevenue > 0 ? Math.round((category.revenue / totalRevenue) * 1000) / 10 : 0
        }))
        .sort((a, b) => b.revenue - a.revenue)
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
