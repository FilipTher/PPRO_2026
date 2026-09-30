import { PrismaClient, Product } from '@prisma/client';
import { CreateProductDto, UpdateProductDto, ProductFilterDto } from '../types';

export interface IProductRepository {
  findAll(filters?: ProductFilterDto): Promise<Product[]>;
  findById(id: number): Promise<Product | null>;
  findByCode(code: string): Promise<Product | null>;
  create(data: CreateProductDto): Promise<Product>;
  update(id: number, data: UpdateProductDto): Promise<Product>;
  delete(id: number): Promise<Product>;
}

export class PrismaProductRepository implements IProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(filters?: ProductFilterDto): Promise<Product[]> {
    const where: any = {};

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const s = filters.search.trim();
      where.OR = [
        { code: { contains: s } },
        { name: { contains: s } },
        { description: { contains: s } }
      ];
    }

    return this.prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: number): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { id }
    });
  }

  async findByCode(code: string): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { code }
    });
  }

  async create(data: CreateProductDto): Promise<Product> {
    return this.prisma.product.create({
      data: {
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        description: data.description?.trim() || null,
        purchasePrice: data.purchasePrice,
        sellingPrice: data.sellingPrice,
        minStockLimit: data.minStockLimit ?? 5,
        isVariantOfId: data.isVariantOfId ?? null
      }
    });
  }

  async update(id: number, data: UpdateProductDto): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description.trim() }),
        ...(data.purchasePrice !== undefined && { purchasePrice: data.purchasePrice }),
        ...(data.sellingPrice !== undefined && { sellingPrice: data.sellingPrice }),
        ...(data.minStockLimit !== undefined && { minStockLimit: data.minStockLimit }),
        ...(data.isActive !== undefined && { isActive: data.isActive })
      }
    });
  }

  async delete(id: number): Promise<Product> {
    // Soft delete dle doménových pravidel – historie se nemaže
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false }
    });
  }
}
