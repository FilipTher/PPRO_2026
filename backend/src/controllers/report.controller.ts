import { Request, Response } from 'express';
import { ReportService } from '../services/report.service';
import { DomainValidationError } from '../errors';

export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  /**
   * GET /api/reports/category-turnover?year=2026&month=11
   * Bez parametrů vrací aktuální kalendářní měsíc.
   */
  getCategoryTurnover = async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const year = this.optionalInt(req.query.year, 'rok', now.getFullYear());
      const month = this.optionalInt(req.query.month, 'měsíc', now.getMonth() + 1);

      const report = await this.reportService.getMonthlyCategoryRevenue(year, month);
      res.json({ success: true, data: report });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  /**
   * GET /api/reports/low-stock – kritické zásoby pod minimem („co hoří“)
   */
  getLowStock = async (_req: Request, res: Response) => {
    try {
      const alerts = await this.reportService.getLowStockAlerts();
      res.json({ success: true, data: alerts });
    } catch (err: any) {
      this.handleError(res, err);
    }
  };

  private optionalInt(value: unknown, label: string, fallback: number): number {
    if (value === undefined || value === '') {
      return fallback;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      throw new DomainValidationError(`Parametr ${label} musí být celé číslo.`);
    }
    return parsed;
  }

  private handleError(res: Response, err: any) {
    if (err instanceof DomainValidationError) {
      return res.status(400).json({ success: false, error: err.message });
    }

    console.error('Neošetřená chyba:', err);
    res.status(500).json({ success: false, error: 'Interní chyba serveru.' });
  }
}
