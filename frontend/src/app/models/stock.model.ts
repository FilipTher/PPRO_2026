export interface WarehouseStockDetail {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export interface ProductStockOverview {
  productId: number;
  productCode: string;
  productName: string;
  minStockLimit: number;
  stocks: WarehouseStockDetail[];
  totalPhysicalQuantity: number;
  totalReservedQuantity: number;
  totalAvailableQuantity: number;
  isLowStock: boolean;
}
