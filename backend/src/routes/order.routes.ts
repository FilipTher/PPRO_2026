import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { OrderService } from '../services/order.service';
import { PrismaOrderRepository } from '../repositories/order.repository';
import { PrismaCustomerRepository } from '../repositories/customer.repository';
import { PrismaProductRepository } from '../repositories/product.repository';
import { PrismaStockRepository } from '../repositories/stock.repository';
import { prisma } from '../prisma';

export function createOrderRouter(): Router {
  const router = Router();

  // Propojení tří vrstev (Dependency Injection)
  const orderRepository = new PrismaOrderRepository(prisma);
  const customerRepository = new PrismaCustomerRepository(prisma);
  const productRepository = new PrismaProductRepository(prisma);
  const stockRepository = new PrismaStockRepository(prisma);

  const service = new OrderService(
    orderRepository,
    customerRepository,
    productRepository,
    stockRepository
  );
  const controller = new OrderController(service);

  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id/items', controller.updateItems);
  router.post('/:id/ship', controller.ship);
  router.post('/:id/cancel', controller.cancel);

  return router;
}
