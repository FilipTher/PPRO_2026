import { Product } from './product.model';
import { Warehouse } from './stock.model';

export type OrderStatus = 'PENDING' | 'RESERVED' | 'SHIPPED' | 'REJECTED' | 'CANCELLED';

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
}

export interface CreateCustomerDto {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
}

export interface OrderItem {
  id: number;
  productId: number;
  warehouseId: number;
  quantity: number;
  unitPrice: number;
  product: Product;
  warehouse: Warehouse;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  status: OrderStatus;
  createdAt: string;
  shippedAt: string | null;
  cancelReason: string | null;
  customer: Customer;
  items: OrderItem[];
}

export interface CreateOrderItemInput {
  productId: number;
  warehouseId: number;
  quantity: number;
}

export interface CreateOrderDto {
  customer: CreateCustomerDto;
  items: CreateOrderItemInput[];
}
