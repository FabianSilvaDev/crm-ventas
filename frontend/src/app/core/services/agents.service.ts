/** Agentes: consulta, ejecucion de tareas simuladas y seguimiento de tareas. */
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import type { ApiResponse } from '../models/api.model';
import type { Agent, AgentStatus, AgentStatusSummary, AgentTask } from '../models/agents.model';
import { ApiService, type QueryParams } from './api.service';

export interface AgentQuery extends QueryParams {
  departmentId?: string;
  status?: AgentStatus;
  search?: string;
  sort?: 'name' | 'level' | 'status' | 'tasks';
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class AgentsService {
  private readonly api = inject(ApiService);

  list(query: AgentQuery = {}): Observable<ApiResponse<Agent[]>> {
    return this.api.get<Agent[]>('/agents', query);
  }

  get(agentId: string): Observable<Agent> {
    return this.api.getData<Agent>(`/agents/${agentId}`);
  }

  summary(): Observable<{ summary: AgentStatusSummary; statuses: AgentStatus[] }> {
    return this.api.getData<{ summary: AgentStatusSummary; statuses: AgentStatus[] }>('/agents/summary');
  }

  /**
   * Lanza una tarea simulada sobre el agente.
   * Devuelve la tarea en estado `running`: hay que sondear `task()` para verla terminar.
   */
  run(agentId: string, body: { title?: string; stageKey?: string } = {}): Observable<AgentTask> {
    return this.api.postData<AgentTask>(`/agents/${agentId}/run`, body);
  }

  task(taskId: string): Observable<AgentTask> {
    return this.api.getData<AgentTask>(`/agents/tasks/${taskId}`);
  }

  tasks(query: { agentId?: string; status?: string; page?: number; pageSize?: number } = {}): Observable<
    ApiResponse<AgentTask[]>
  > {
    return this.api.get<AgentTask[]>('/agents/tasks', query);
  }

  search(term: string, limit = 5): Observable<Agent[]> {
    return this.api.getData<Agent[]>('/agents/search', { q: term, limit });
  }
}
