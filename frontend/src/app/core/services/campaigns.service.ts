/** Campanas simuladas y su resumen publicitario. */
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import type { ApiResponse } from '../models/api.model';
import type { Campaign } from '../models/catalog.model';
import type { CampaignRankingRow, ChannelTotal } from '../models/insights.model';
import { ApiService, type QueryParams } from './api.service';

export interface CampaignQuery extends QueryParams {
  status?: string;
  channel?: string;
  search?: string;
  sort?: 'revenue' | 'roas' | 'spend' | 'conversions' | 'startDate' | 'name';
  page?: number;
  pageSize?: number;
}

/** Agregados de la vista de campanas. */
export interface CampaignSummary {
  totals: {
    budget: number;
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
    conversions: number;
    revenue: number;
    active: number;
    paused: number;
    scheduled: number;
    finished: number;
    total: number;
    ctr: number;
    cpc: number;
    cpl: number;
    cpa: number;
    roas: number;
    budgetPacing: number;
  };
  byChannel: ChannelTotal[];
  ranking: CampaignRankingRow[];
  statusBreakdown: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class CampaignsService {
  private readonly api = inject(ApiService);

  list(query: CampaignQuery = {}): Observable<ApiResponse<Campaign[]>> {
    return this.api.get<Campaign[]>('/campaigns', query);
  }

  get(campaignId: string): Observable<Campaign> {
    return this.api.getData<Campaign>(`/campaigns/${campaignId}`);
  }

  summary(): Observable<CampaignSummary> {
    return this.api.getData<CampaignSummary>('/campaigns/summary');
  }
}
