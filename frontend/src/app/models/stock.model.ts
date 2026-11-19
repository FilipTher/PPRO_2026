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

export interface Warehouse {
  id: number;
  name: string;
  code: string;
  address: string;
  isSeasonal: boolean;
}

export interface ReceiveStockDto {
  productId: number;
  warehouseId: number;
  quantity: number;
  reason?: string;
  note?: string;
}

export interface TransferStockDto {
  productId: number;
  sourceWarehouseId: number;
  targetWarehouseId: number;
  quantity: number;
  note?: string;
}

export interface InventoryAdjustmentDto {
  productId: number;
  warehouseId: number;
  actualPhysicalQuantity: number;
  reason: string;
  note?: string;
}
