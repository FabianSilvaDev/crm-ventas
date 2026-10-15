/** Landing pages, experimentos A/B y resumen tecnico. */
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import type { ApiResponse } from '../models/api.model';
import type { ExperimentResult, LandingPage } from '../models/catalog.model';
import { ApiService, type QueryParams } from './api.service';

export interface LandingQuery extends QueryParams {
  status?: string;
  template?: string;
  search?: string;
  sort?: 'visitors' | 'conversionRate' | 'seo' | 'recent' | 'title';
  page?: number;
  pageSize?: number;
}

/** Agregados de la vista de landings. */
export interface LandingSummary {
  totals: {
    total: number;
    published: number;
    draft: number;
    visitors: number;
    conversions: number;
    conversionRate: number;
  };
  experiments: ExperimentResult[];
  technical: {
    averageLcpMs: number;
    averageSeoScore: number;
    pagesNeedingWork: { id: string; slug: string; seoScore: number; lcpMs: number }[];
  };
  relatedCampaigns: unknown[];
}

@Injectable({ providedIn: 'root' })
export class LandingPagesService {
  private readonly api = inject(ApiService);

  list(query: LandingQuery = {}): Observable<ApiResponse<LandingPage[]>> {
    return this.api.get<LandingPage[]>('/landing-pages', query);
  }

  get(landingPageId: string): Observable<LandingPage> {
    return this.api.getData<LandingPage>(`/landing-pages/${landingPageId}`);
  }

  summary(): Observable<LandingSummary> {
    return this.api.getData<LandingSummary>('/landing-pages/summary');
  }
}
