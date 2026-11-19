/**
 * Doménové modely – čisté typy bez závislosti na Prisma/DB driveru.
 * Repozitáře mapují výsledky Prismy na tyto tvary (strukturálně jsou shodné).
 */

export interface Product {
  id: number;
  code: string;
  name: string;
  description: string | null;
  purchasePrice: number;
  sellingPrice: number;
  minStockLimit: number;
  isActive: boolean;
  isVariantOfId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
}

export interface Warehouse {
  id: number;
  name: string;
  code: string;
  address: string;
  isSeasonal: boolean;
}

export interface WarehouseStock {
  id: number;
  warehouseId: number;
  productId: number;
  physicalQuantity: number;
  reservedQuantity: number;
}

export interface StockMovement {
  id: number;
  productId: number;
  warehouseId: number;
  orderId: number | null;
  movementType: string;
  quantityChange: number;
  quantityAfter: number;
  reason: string | null;
  note: string | null;
  createdAt: Date;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
  createdAt: Date;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  status: string;
  createdAt: Date;
  shippedAt: Date | null;
  cancelReason: string | null;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  warehouseId: number;
  quantity: number;
  unitPrice: number;
}
