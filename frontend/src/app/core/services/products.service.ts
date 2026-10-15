/** Productos investigados y ofertas derivadas. */
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import type { ApiResponse } from '../models/api.model';
import type { Offer, Product } from '../models/catalog.model';
import { ApiService, type QueryParams } from './api.service';

export interface ProductQuery extends QueryParams {
  status?: string;
  category?: string;
  search?: string;
  sort?: 'revenue' | 'score' | 'margin' | 'name' | 'updated';
  page?: number;
  pageSize?: number;
}

export interface OfferQuery extends QueryParams {
  status?: string;
  productId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly api = inject(ApiService);

  list(query: ProductQuery = {}): Observable<ApiResponse<Product[]>> {
    return this.api.get<Product[]>('/products', query);
  }

  get(productId: string): Observable<Product> {
    return this.api.getData<Product>(`/products/${productId}`);
  }

  offers(query: OfferQuery = {}): Observable<ApiResponse<Offer[]>> {
    return this.api.get<Offer[]>('/offers', query);
  }

  offer(offerId: string): Observable<Offer> {
    return this.api.getData<Offer>(`/offers/${offerId}`);
  }
}
