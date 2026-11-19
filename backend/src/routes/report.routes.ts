import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { ReportService } from '../services/report.service';
import { PrismaReportRepository } from '../repositories/report.repository';
import { prisma } from '../prisma';

export function createReportRouter(): Router {
  const router = Router();

  // Propojení tří vrstev (Dependency Injection)
  const repository = new PrismaReportRepository(prisma);
  const service = new ReportService(repository);
  const controller = new ReportController(service);

  router.get('/category-turnover', controller.getCategoryTurnover);

  return router;
}
