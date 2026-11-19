import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/product.model';
import { LowStockAlert, MonthlyCategoryRevenue } from '../models/report.model';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/reports';

  getLowStockAlerts(): Observable<ApiResponse<LowStockAlert[]>> {
    return this.http.get<ApiResponse<LowStockAlert[]>>(`${this.apiUrl}/low-stock`);
  }

  getCategoryTurnover(year: number, month: number): Observable<ApiResponse<MonthlyCategoryRevenue>> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.get<ApiResponse<MonthlyCategoryRevenue>>(`${this.apiUrl}/category-turnover`, {
      params
    });
  }
}
