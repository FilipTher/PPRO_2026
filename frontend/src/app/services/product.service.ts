import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, CreateProductDto, ApiResponse } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/products';

  getProducts(search?: string, isActive?: boolean): Observable<ApiResponse<Product[]>> {
    let params = new HttpParams();
    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }
    if (isActive !== undefined) {
      params = params.set('isActive', String(isActive));
    }
    return this.http.get<ApiResponse<Product[]>>(this.apiUrl, { params });
  }

  getProductById(id: number): Observable<ApiResponse<Product>> {
    return this.http.get<ApiResponse<Product>>(`${this.apiUrl}/${id}`);
  }

  createProduct(dto: CreateProductDto): Observable<ApiResponse<Product>> {
    return this.http.post<ApiResponse<Product>>(this.apiUrl, dto);
  }

  deactivateProduct(id: number): Observable<ApiResponse<Product>> {
    return this.http.delete<ApiResponse<Product>>(`${this.apiUrl}/${id}`);
  }
}
