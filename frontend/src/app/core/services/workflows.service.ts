/** Flujos: catalogo, definicion y control de las ejecuciones simuladas. */
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import type { ApiResponse } from '../models/api.model';
import type { Workflow, WorkflowRun, WorkflowStage } from '../models/workflows.model';
import { ApiService, type QueryParams } from './api.service';

export interface RunQuery extends QueryParams {
  workflowId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class WorkflowsService {
  private readonly api = inject(ApiService);

  list(): Observable<Workflow[]> {
    return this.api.getData<Workflow[]>('/workflows');
  }

  get(workflowId: string): Observable<Workflow> {
    return this.api.getData<Workflow>(`/workflows/${workflowId}`);
  }

  /** Catalogo de las 17 etapas, con independencia del flujo. */
  stages(): Observable<WorkflowStage[]> {
    return this.api.getData<WorkflowStage[]>('/workflows/stages');
  }

  /**
   * Inicia una ejecucion. El backend responde de inmediato con el `runId` y sigue
   * avanzando en segundo plano: la vista debe sondear `run()`.
   *
   * Con `opportunityId`, la ejecucion queda ligada a esa oportunidad aprobada y cada
   * etapa produce sus artefactos en lugar del caso de demostracion.
   */
  start(workflowId: string, options: { opportunityId?: string } = {}): Observable<WorkflowRun> {
    return this.api.postData<WorkflowRun>(`/workflows/${workflowId}/run`, options);
  }

  run(runId: string): Observable<WorkflowRun> {
    return this.api.getData<WorkflowRun>(`/workflows/runs/${runId}`);
  }

  runs(query: RunQuery = {}): Observable<ApiResponse<WorkflowRun[]>> {
    return this.api.get<WorkflowRun[]>('/workflows/runs', query);
  }

  pause(runId: string): Observable<WorkflowRun> {
    return this.api.postData<WorkflowRun>(`/workflows/runs/${runId}/pause`);
  }

  resume(runId: string): Observable<WorkflowRun> {
    return this.api.postData<WorkflowRun>(`/workflows/runs/${runId}/resume`);
  }

  reset(runId: string): Observable<WorkflowRun> {
    return this.api.postData<WorkflowRun>(`/workflows/runs/${runId}/reset`);
  }

  /** Aprueba la puerta de decision abierta: el flujo continua. */
  approveGate(runId: string): Observable<WorkflowRun> {
    return this.api.postData<WorkflowRun>(`/workflows/runs/${runId}/approve`);
  }

  /**
   * Rechaza la puerta abierta: el ciclo se detiene y, si la ejecucion nacia de una
   * oportunidad, esta se descarta con el motivo.
   */
  rejectGate(runId: string, reason?: string): Observable<WorkflowRun & { discardedOpportunityId: string | null }> {
    return this.api.postData<WorkflowRun & { discardedOpportunityId: string | null }>(
      `/workflows/runs/${runId}/reject`,
      reason ? { reason } : {},
    );
  }
}
