import { PrismaClient, Product, Category } from '@prisma/client';
import { CreateProductDto, UpdateProductDto, ProductFilterDto } from '../types';

/** Produkt včetně přiřazených kategorií (vazba M:N ProductCategory) */
export type ProductWithCategories = Product & { categories: Category[] };

type ProductWithJoin = Product & { categories: { category: Category }[] };

const categoryInclude = {
  categories: {
    include: { category: true }
  }
};

export interface IProductRepository {
  findAll(filters?: ProductFilterDto): Promise<ProductWithCategories[]>;
  findById(id: number): Promise<ProductWithCategories | null>;
  findByCode(code: string): Promise<ProductWithCategories | null>;
  create(data: CreateProductDto): Promise<ProductWithCategories>;
  update(id: number, data: UpdateProductDto): Promise<ProductWithCategories>;
  delete(id: number): Promise<ProductWithCategories>;
}

export class PrismaProductRepository implements IProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(filters?: ProductFilterDto): Promise<ProductWithCategories[]> {
    const where: any = {};

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.categoryId !== undefined) {
      where.categories = { some: { categoryId: filters.categoryId } };
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const s = filters.search.trim();
      where.OR = [
        { code: { contains: s } },
        { name: { contains: s } },
        { description: { contains: s } }
      ];
    }

    const products = await this.prisma.product.findMany({
      where,
      include: categoryInclude,
      orderBy: { createdAt: 'desc' }
    });

    return products.map((product) => this.toProductWithCategories(product));
  }

  async findById(id: number): Promise<ProductWithCategories | null> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: categoryInclude
    });

    return product ? this.toProductWithCategories(product) : null;
  }

  async findByCode(code: string): Promise<ProductWithCategories | null> {
    const product = await this.prisma.product.findUnique({
      where: { code },
      include: categoryInclude
    });

    return product ? this.toProductWithCategories(product) : null;
  }

  async create(data: CreateProductDto): Promise<ProductWithCategories> {
    const product = await this.prisma.product.create({
      data: {
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        description: data.description?.trim() || null,
        purchasePrice: data.purchasePrice,
        sellingPrice: data.sellingPrice,
        minStockLimit: data.minStockLimit ?? 5,
        isVariantOfId: data.isVariantOfId ?? null,
        // Vazba M:N – jeden produkt může patřit do více kategorií naráz
        ...(data.categoryIds?.length
          ? { categories: { create: data.categoryIds.map((categoryId) => ({ categoryId })) } }
          : {})
      },
      include: categoryInclude
    });

    return this.toProductWithCategories(product);
  }

  async update(id: number, data: UpdateProductDto): Promise<ProductWithCategories> {
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description.trim() }),
        ...(data.purchasePrice !== undefined && { purchasePrice: data.purchasePrice }),
        ...(data.sellingPrice !== undefined && { sellingPrice: data.sellingPrice }),
        ...(data.minStockLimit !== undefined && { minStockLimit: data.minStockLimit }),
        ...(data.isActive !== undefined && { isActive: data.isActive })
      },
      include: categoryInclude
    });

    return this.toProductWithCategories(product);
  }

  async delete(id: number): Promise<ProductWithCategories> {
    // Soft delete dle doménových pravidel – historie se nemaže
    const product = await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: categoryInclude
    });

    return this.toProductWithCategories(product);
  }

  private toProductWithCategories(product: ProductWithJoin): ProductWithCategories {
    const { categories, ...fields } = product;
    return { ...fields, categories: categories.map((link) => link.category) };
  }
}
