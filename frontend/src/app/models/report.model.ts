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
