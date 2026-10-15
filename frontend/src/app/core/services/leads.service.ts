/** Leads y embudo comercial. */
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import type { ApiResponse } from '../models/api.model';
import type { Lead, LeadStatus } from '../models/catalog.model';
import type { LeadTotals } from '../models/insights.model';
import { ApiService, type QueryParams } from './api.service';

export interface LeadQuery extends QueryParams {
  status?: LeadStatus;
  origin?: string;
  priority?: 'alta' | 'media' | 'baja';
  campaignId?: string;
  offerId?: string;
  minScore?: number;
  search?: string;
  sort?: 'score' | 'value' | 'recent' | 'company';
  page?: number;
  pageSize?: number;
}

/** Resumen del embudo usado por la cabecera de la vista de leads. */
export interface LeadsSummary {
  totals: LeadTotals;
  statuses: LeadStatus[];
  origins: string[];
  byOrigin: { origin: string; count: number; won: number; value: number }[];
  byPriority: { priority: string; count: number }[];
  topLeads: Lead[];
}

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly api = inject(ApiService);

  list(query: LeadQuery = {}): Observable<ApiResponse<Lead[]>> {
    return this.api.get<Lead[]>('/leads', query);
  }

  get(leadId: string): Observable<Lead> {
    return this.api.getData<Lead>(`/leads/${leadId}`);
  }

  summary(): Observable<LeadsSummary> {
    return this.api.getData<LeadsSummary>('/leads/summary');
  }
}
