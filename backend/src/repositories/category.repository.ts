import { PrismaClient, Category } from '@prisma/client';

export interface ICategoryRepository {
  findAll(): Promise<Category[]>;
  findByIds(ids: number[]): Promise<Category[]>;
}

export class PrismaCategoryRepository implements ICategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async findByIds(ids: number[]): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { id: { in: ids } }
    });
  }
}
