export interface CreateProductDto {
  code: string;
  name: string;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
  minStockLimit?: number;
  isVariantOfId?: number;
  categoryIds?: number[];
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  minStockLimit?: number;
  isActive?: boolean;
}

export interface ProductFilterDto {
  search?: string;
  isActive?: boolean;
  categoryId?: number;
}

export * from './stock.types';
export * from './order.types';
export * from '../domain/models';
export * from './report.types';
