/**
 * Servicio de oportunidades: la cola del intake, el estudio y las fuentes.
 *
 * El estudio (`scan`) consulta fuentes externas y puede tardar, asi que es una
 * accion explicita del operador, no algo que se dispare al abrir la vista.
 */
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import type { ApiResponse } from '../models/api.model';
import type {
  DataSourceInfo,
  DiscoverResult,
  Opportunity,
  OpportunityStatus,
  OpportunitySummary,
  ScanConstraints,
  ScanResult,
} from '../models/opportunities.model';
import { ApiService, type QueryParams } from './api.service';
import type { WorkflowRun } from '../models/workflows.model';

export interface OpportunityQuery extends QueryParams {
  status?: OpportunityStatus;
  origin?: string;
  minScore?: number;
  search?: string;
  sort?: 'score' | 'recent' | 'coverage' | 'keyword' | 'status';
  page?: number;
  pageSize?: number;
}

/** Cuerpo de un estudio de oportunidad. */
export interface ScanRequest {
  keywords: string[];
  mode?: 'auto' | 'live' | 'simulated';
  geo?: string;
  timeframe?: string;
  constraints?: Partial<ScanConstraints>;
  /** Con `false` el estudio es una simulacion y no registra nada en la cola. */
  register?: boolean;
}

@Injectable({ providedIn: 'root' })
export class OpportunitiesService {
  private readonly api = inject(ApiService);

  list(query: OpportunityQuery = {}): Observable<ApiResponse<Opportunity[]>> {
    return this.api.get<Opportunity[]>('/opportunities', query);
  }

  get(opportunityId: string): Observable<Opportunity> {
    return this.api.getData<Opportunity>(`/opportunities/${opportunityId}`);
  }

  summary(): Observable<OpportunitySummary> {
    return this.api.getData<OpportunitySummary>('/opportunities/summary');
  }

  /** Aprueba la oportunidad: es lo que la habilita para entrar al flujo. */
  approve(opportunityId: string, reason?: string): Observable<Opportunity> {
    return this.api.postData<Opportunity>(`/opportunities/${opportunityId}/approve`, reason ? { reason } : {});
  }

  /**
   * Aclara que producto es, sin aprobar: el paso previo del primer filtro.
   * Con `productId` se enlaza la cadena real del catalogo; con `productName` se acepta un
   * producto que no esta en el catalogo; con `asCategory` se decide que basta la categoria.
   */
  setProduct(
    opportunityId: string,
    payload: { productId?: string; productName?: string; asCategory?: boolean; reason?: string },
  ): Observable<Opportunity> {
    return this.api.postData<Opportunity>(`/opportunities/${opportunityId}/product`, payload);
  }

  discard(opportunityId: string, reason?: string): Observable<Opportunity> {
    return this.api.postData<Opportunity>(`/opportunities/${opportunityId}/discard`, reason ? { reason } : {});
  }

  /**
   * Lanza el flujo atado a una oportunidad aprobada.
   * El backend responde 202 con la ejecucion ya creada; su avance se sigue en `/workflows`.
   */
  launch(opportunityId: string, workflowId?: string): Observable<WorkflowRun> {
    return this.api.postData<WorkflowRun>(`/opportunities/${opportunityId}/run`, workflowId ? { workflowId } : {});
  }

  /** Ejecuta un estudio y registra las candidatas en la cola. */
  scan(request: ScanRequest): Observable<ScanResult> {
    return this.api.postData<ScanResult>('/intake/scan', request);
  }

  /** Terminos que estan subiendo ahora (Google Trends). */
  discover(geo?: string, limit = 10): Observable<DiscoverResult> {
    return this.api.getData<DiscoverResult>('/intake/discover', { geo, limit });
  }

  /** Fuentes de datos disponibles y su estado real. */
  sources(): Observable<{ mode: string; sources: DataSourceInfo[] }> {
    return this.api.getData<{ mode: string; sources: DataSourceInfo[] }>('/sources');
  }
}
