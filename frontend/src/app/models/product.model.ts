export interface Product {
  id: number;
  code: string;
  name: string;
  description: string | null;
  purchasePrice: number;
  sellingPrice: number;
  minStockLimit: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  code: string;
  name: string;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
  minStockLimit?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}
