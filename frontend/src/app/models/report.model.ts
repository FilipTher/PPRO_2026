export type LowStockSeverity = 'CRITICAL' | 'WARNING';

export interface LowStockAlert {
  productId: number;
  productCode: string;
  productName: string;
  totalPhysicalQuantity: number;
  minStockLimit: number;
  recommendedQuantity: number;
  severity: LowStockSeverity;
}

export interface CategoryRevenue {
  categoryId: number;
  categoryName: string;
  revenue: number;
  quantity: number;
  revenueSharePercent: number;
}

export interface MonthlyCategoryRevenue {
  year: number;
  month: number;
  periodFrom: string;
  periodTo: string;
  totalRevenue: number;
  totalQuantity: number;
  categories: CategoryRevenue[];
}
