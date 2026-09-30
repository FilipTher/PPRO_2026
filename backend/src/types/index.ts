export interface CreateProductDto {
  code: string;
  name: string;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
  minStockLimit?: number;
  isVariantOfId?: number;
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
}
