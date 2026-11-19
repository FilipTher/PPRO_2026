import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';
import { CategoryService } from '../services/category.service';
import { PrismaCategoryRepository } from '../repositories/category.repository';
import { prisma } from '../prisma';

export function createCategoryRouter(): Router {
  const router = Router();

  // Propojení tří vrstev (Dependency Injection)
  const repository = new PrismaCategoryRepository(prisma);
  const service = new CategoryService(repository);
  const controller = new CategoryController(service);

  router.get('/', controller.getAll);

  return router;
}
