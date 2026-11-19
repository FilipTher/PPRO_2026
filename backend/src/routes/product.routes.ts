import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { ProductService } from '../services/product.service';
import { PrismaProductRepository } from '../repositories/product.repository';
import { PrismaCategoryRepository } from '../repositories/category.repository';
import { prisma } from '../prisma';

export function createProductRouter(): Router {
  const router = Router();

  // Propojení tří vrstev (Dependency Injection)
  const repository = new PrismaProductRepository(prisma);
  const categoryRepository = new PrismaCategoryRepository(prisma);
  const service = new ProductService(repository, categoryRepository);
  const controller = new ProductController(service);

  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.deactivate);

  return router;
}
