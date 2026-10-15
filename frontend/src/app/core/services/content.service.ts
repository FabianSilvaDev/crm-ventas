/** Contenido y creatividades. */
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import type { ApiResponse } from '../models/api.model';
import type { ContentPiece, Creative } from '../models/catalog.model';
import { ApiService, type QueryParams } from './api.service';

export interface ContentQuery extends QueryParams {
  type?: string;
  status?: string;
  channel?: string;
  search?: string;
  sort?: 'recent' | 'impressions' | 'conversions' | 'title';
  page?: number;
  pageSize?: number;
}

export interface CreativeQuery extends QueryParams {
  format?: string;
  status?: string;
  campaignId?: string;
  search?: string;
  sort?: 'impressions' | 'conversions' | 'recent' | 'name';
  page?: number;
  pageSize?: number;
}

/** Agregados de la vista de contenido. */
export interface ContentSummary {
  totals: {
    pieces: number;
    published: number;
    inProgress: number;
    creatives: number;
    liveCreatives: number;
    impressions: number;
    conversions: number;
    words: number;
  };
  byType: { type: string; count: number; conversions: number }[];
  topContent: ContentPiece[];
  topCreatives: Creative[];
}

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly api = inject(ApiService);

  list(query: ContentQuery = {}): Observable<ApiResponse<ContentPiece[]>> {
    return this.api.get<ContentPiece[]>('/content', query);
  }

  get(contentId: string): Observable<ContentPiece> {
    return this.api.getData<ContentPiece>(`/content/${contentId}`);
  }

  creatives(query: CreativeQuery = {}): Observable<ApiResponse<Creative[]>> {
    return this.api.get<Creative[]>('/creatives', query);
  }

  creative(creativeId: string): Observable<Creative> {
    return this.api.getData<Creative>(`/creatives/${creativeId}`);
  }

  summary(): Observable<ContentSummary> {
    return this.api.getData<ContentSummary>('/content/summary');
  }
}
