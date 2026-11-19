import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { ReportService } from '../services/report.service';
import { StockService } from '../services/stock.service';
import { PrismaReportRepository } from '../repositories/report.repository';
import { PrismaStockRepository } from '../repositories/stock.repository';
import { PrismaProductRepository } from '../repositories/product.repository';
import { prisma } from '../prisma';

export function createReportRouter(): Router {
  const router = Router();

  // Propojení tří vrstev (Dependency Injection)
  const reportRepository = new PrismaReportRepository(prisma);
  const stockService = new StockService(
    new PrismaStockRepository(prisma),
    new PrismaProductRepository(prisma)
  );

  const service = new ReportService(reportRepository, stockService);
  const controller = new ReportController(service);

  router.get('/category-turnover', controller.getCategoryTurnover);
  router.get('/low-stock', controller.getLowStock);

  return router;
}
