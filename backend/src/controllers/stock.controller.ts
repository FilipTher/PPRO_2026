import { Request, Response } from 'express';
import { StockService } from '../services/stock.service';

export class StockController {
  constructor(private readonly stockService: StockService) {}

  /**
   * GET /api/stock/overview – zásoby všech aktivních produktů po skladech
   * (fyzický, rezervovaný a disponibilní stav + flag nízké zásoby).
   */
  getOverview = async (_req: Request, res: Response) => {
    try {
      const overview = await this.stockService.getStockOverview();
      res.json({ success: true, data: overview });
    } catch (err: any) {
      console.error('Neošetřená chyba:', err);
      res.status(500).json({ success: false, error: 'Interní chyba serveru.' });
    }
  };
}
