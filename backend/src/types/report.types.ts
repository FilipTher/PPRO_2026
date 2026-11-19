export interface CategoryRevenueRow {
  categoryId: number;
  categoryName: string;
  revenue: number;
  quantity: number;
}

export interface ShippedRevenueSummary {
  totalRevenue: number;
  totalQuantity: number;
  categories: CategoryRevenueRow[];
}

export interface CategoryRevenueDto extends CategoryRevenueRow {
  /** Podíl na celkových tržbách firmy v daném měsíci (může se u více kategorií překrývat). */
  revenueSharePercent: number;
}

export interface MonthlyCategoryRevenueDto {
  year: number;
  month: number;
  periodFrom: string;
  periodTo: string;
  totalRevenue: number;
  totalQuantity: number;
  categories: CategoryRevenueDto[];
}

export type LowStockSeverity = 'CRITICAL' | 'WARNING';

export interface LowStockAlertDto {
  productId: number;
  productCode: string;
  productName: string;
  totalPhysicalQuantity: number;
  totalReservedQuantity: number;
  totalAvailableQuantity: number;
  minStockLimit: number;
  recommendedQuantity: number;
  severity: LowStockSeverity;
  stocks: {
    warehouseId: number;
    warehouseCode: string;
    warehouseName: string;
    physicalQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
  }[];
}
