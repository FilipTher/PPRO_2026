import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ProductStockOverview,
  ReceiveStockDto,
  TransferStockDto,
  Warehouse
} from '../models/stock.model';
import { ApiResponse } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/stock';

  getStockOverview(): Observable<ApiResponse<ProductStockOverview[]>> {
    return this.http.get<ApiResponse<ProductStockOverview[]>>(`${this.apiUrl}/overview`);
  }

  getWarehouses(): Observable<ApiResponse<Warehouse[]>> {
    return this.http.get<ApiResponse<Warehouse[]>>(`${this.apiUrl}/warehouses`);
  }

  receiveStock(dto: ReceiveStockDto): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.apiUrl}/receipt`, dto);
  }

  transferStock(dto: TransferStockDto): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.apiUrl}/transfer`, dto);
  }
}
