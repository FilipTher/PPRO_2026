import { Router } from 'express';
import { StockController } from '../controllers/stock.controller';
import { StockService } from '../services/stock.service';
import { PrismaStockRepository } from '../repositories/stock.repository';
import { PrismaProductRepository } from '../repositories/product.repository';
import { prisma } from '../prisma';

export function createStockRouter(): Router {
  const router = Router();

  // Propojení tří vrstev (Dependency Injection)
  const stockRepository = new PrismaStockRepository(prisma);
  const productRepository = new PrismaProductRepository(prisma);
  const service = new StockService(stockRepository, productRepository);
  const controller = new StockController(service);

  router.get('/warehouses', controller.getWarehouses);
  router.get('/overview', controller.getOverview);
  router.get('/movements', controller.getMovements);
  router.post('/receipt', controller.receive);
  router.post('/transfer', controller.transfer);
  router.post('/inventory', controller.inventory);

  return router;
}
