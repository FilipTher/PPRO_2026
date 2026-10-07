export type MovementType =
  | 'RECEIPT'
  | 'DISPATCH'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'INVENTORY_ADJUSTMENT';

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

export interface RecordMovementDto {
  productId: number;
  warehouseId: number;
  movementType: MovementType | string;
  quantityChange: number;
  quantityAfter: number;
  orderId?: number | null;
  reason?: string | null;
  note?: string | null;
}

export interface StockMovementFilterDto {
  productId?: number;
  warehouseId?: number;
  movementType?: string;
  orderId?: number;
  from?: Date;
  to?: Date;
}

export interface WarehouseStockDetail {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export interface ProductStockOverviewDto {
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
