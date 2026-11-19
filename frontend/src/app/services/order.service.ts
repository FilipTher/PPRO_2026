import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/product.model';
import {
  CreateOrderDto,
  CreateOrderItemInput,
  Order,
  OrderStatus
} from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/orders';

  getOrders(status?: OrderStatus): Observable<ApiResponse<Order[]>> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<ApiResponse<Order[]>>(this.apiUrl, { params });
  }

  getOrderById(id: number): Observable<ApiResponse<Order>> {
    return this.http.get<ApiResponse<Order>>(`${this.apiUrl}/${id}`);
  }

  createOrder(dto: CreateOrderDto): Observable<ApiResponse<Order>> {
    return this.http.post<ApiResponse<Order>>(this.apiUrl, dto);
  }

  shipOrder(id: number): Observable<ApiResponse<Order>> {
    return this.http.post<ApiResponse<Order>>(`${this.apiUrl}/${id}/ship`, {});
  }

  cancelOrder(id: number, reason: string): Observable<ApiResponse<Order>> {
    return this.http.post<ApiResponse<Order>>(`${this.apiUrl}/${id}/cancel`, { reason });
  }

  updateOrderItems(id: number, items: CreateOrderItemInput[]): Observable<ApiResponse<Order>> {
    return this.http.put<ApiResponse<Order>>(`${this.apiUrl}/${id}/items`, { items });
  }
}
