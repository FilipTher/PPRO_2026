import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/product.model';
import { LowStockAlert } from '../models/report.model';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/reports';

  getLowStockAlerts(): Observable<ApiResponse<LowStockAlert[]>> {
    return this.http.get<ApiResponse<LowStockAlert[]>>(`${this.apiUrl}/low-stock`);
  }
}
