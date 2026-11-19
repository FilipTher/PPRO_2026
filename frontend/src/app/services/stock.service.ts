import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProductStockOverview } from '../models/stock.model';
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
}
