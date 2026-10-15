/** Investigacion de mercado. */
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import type { ApiResponse } from '../models/api.model';
import type { ResearchReport } from '../models/catalog.model';
import { ApiService, type QueryParams } from './api.service';

export interface ResearchQuery extends QueryParams {
  type?: string;
  status?: string;
  productId?: string;
  search?: string;
  sort?: 'recent' | 'title' | 'type';
  page?: number;
  pageSize?: number;
}

/** Agregados de la vista de investigacion. */
export interface ResearchSummary {
  totals: {
    reports: number;
    published: number;
    findings: number;
    sources: number;
    competitors: number;
  };
  byType: { type: string; count: number }[];
  pendingValidation: ResearchReport[];
}

@Injectable({ providedIn: 'root' })
export class ResearchService {
  private readonly api = inject(ApiService);

  list(query: ResearchQuery = {}): Observable<ApiResponse<ResearchReport[]>> {
    return this.api.get<ResearchReport[]>('/research', query);
  }

  get(researchId: string): Observable<ResearchReport> {
    return this.api.getData<ResearchReport>(`/research/${researchId}`);
  }

  summary(): Observable<ResearchSummary> {
    return this.api.getData<ResearchSummary>('/research/summary');
  }
}
