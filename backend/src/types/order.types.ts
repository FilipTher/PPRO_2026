import { Customer, Order, OrderItem, Product, Warehouse } from '@prisma/client';

/**
 * Stavy objednávky dle README:
 * PENDING -> RESERVED -> SHIPPED, případně REJECTED / CANCELLED.
 */
export type OrderStatus = 'PENDING' | 'RESERVED' | 'SHIPPED' | 'REJECTED' | 'CANCELLED';

export interface CreateCustomerDto {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
}

export interface CreateOrderItemDto {
  productId: number;
  warehouseId: number;
  quantity: number;
  /** Cena zafixovaná v okamžiku vytvoření objednávky (nesmí se měnit s ceníkem). */
  unitPrice: number;
}

export interface CreateOrderWithItemsDto {
  orderNumber: string;
  customerId: number;
  status?: OrderStatus;
  items: CreateOrderItemDto[];
}

export interface OrderFilterDto {
  status?: OrderStatus;
  customerId?: number;
  from?: Date;
  to?: Date;
}

export type OrderItemWithRelations = OrderItem & {
  product: Product;
  warehouse: Warehouse;
};

export type OrderWithRelations = Order & {
  customer: Customer;
  items: OrderItemWithRelations[];
};
