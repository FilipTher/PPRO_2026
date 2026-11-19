import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { CustomerService } from '../services/customer.service';
import { PrismaCustomerRepository } from '../repositories/customer.repository';
import { prisma } from '../prisma';

export function createCustomerRouter(): Router {
  const router = Router();

  // Propojení tří vrstev (Dependency Injection)
  const repository = new PrismaCustomerRepository(prisma);
  const service = new CustomerService(repository);
  const controller = new CustomerController(service);

  router.get('/', controller.getAll);

  return router;
}
