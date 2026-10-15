/** Agentes, avatares procedurales y departamentos de la oficina. */
import type { AccentKey } from './api.model';

/** Estados posibles de un agente. */
export type AgentStatus =
  | 'idle'
  | 'working'
  | 'thinking'
  | 'collaborating'
  | 'completed'
  | 'error'
  | 'offline';

/**
 * Descripcion de un avatar procedural.
 * El frontend compone el sprite pixel art a partir de estos campos: no hay
 * imagenes ni binarios (ver docs/architecture.md).
 */
export interface AgentAvatar {
  /** Silueta del personaje. */
  body: 'a' | 'b' | 'c' | 'd';
  /** Color del departamento (acento). */
  palette: AccentKey;
  hair: 'dark' | 'brown' | 'blond' | 'red' | 'gray' | 'violet';
  skin: 'light' | 'medium' | 'dark' | 'deep';
  accessory: 'glasses' | 'headset' | 'tablet' | 'none';
}

export interface DepartmentRef {
  id: string;
  name: string;
  shortName: string;
  accent: AccentKey;
}

/** Referencia ligera a un agente, tal como la devuelven los servicios de la API. */
export interface AgentRef {
  id: string;
  name: string;
  role: string;
  specialty: string;
  status: AgentStatus;
  avatar: AgentAvatar;
  department: DepartmentRef | null;
}

/** Tarea en curso de un agente. */
export interface AgentTaskSummary {
  id: string;
  title: string;
  stageKey: string | null;
  progress: number;
  etaMinutes: number;
  collaborators: string[];
  error?: string;
}

export interface AgentResult {
  id: string;
  title: string;
  summary: string;
  at: string;
  metric: { label: string; value: string } | null;
}

export interface AgentStats {
  tasksCompleted: number;
  successRate: number;
  avgTaskMinutes: number;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  specialty: string;
  avatar: AgentAvatar;
  level: number;
  capabilities: string[];
  bio: string;
  department: DepartmentRef | null;
  status: AgentStatus;
  stats: AgentStats;
  currentTask: AgentTaskSummary | null;
  /** Progreso de la tarea actual (0-1); 0 si esta inactivo. */
  progress: number;
  lastActivityAt: string;
  recentResult: AgentResult | null;
  openTasks: number;
}

/** Resumen de plantilla por estado. */
export interface AgentStatusSummary {
  total: number;
  active: number;
  byStatus: Record<AgentStatus, number>;
}

/** Tarea ejecutada sobre un agente a traves de `POST /agents/:id/run`. */
export interface AgentTask {
  id: string;
  agentId: string;
  agentName: string;
  department: DepartmentRef | null;
  title: string;
  stageKey: string | null;
  status: 'running' | 'completed' | 'error';
  progress: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number;
  etaMs: number;
  result: {
    title: string;
    summary: string;
    metrics: { label: string; value: string }[];
    artifacts: { type: string; id: string; label: string }[];
    completedAt?: string;
    durationMs?: number;
  } | null;
  error: string | null;
}

/** Agente tal como aparece en la carga de un departamento. */
export interface DepartmentAgent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  avatar: AgentAvatar;
  progress: number;
  taskTitle: string | null;
}

export interface Department {
  id: string;
  name: string;
  shortName: string;
  description: string;
  accent: AccentKey;
  /** Posicion de la sala en la rejilla del escenario pixel art. */
  room: { col: number; row: number };
  tile: { floor: string; wall: string; palette: AccentKey };
  stats: {
    agentCount: number;
    active: number;
    byStatus: Partial<Record<AgentStatus, number>>;
    tasksCompleted: number;
    successRate: number;
  };
  lead: AgentRef | null;
  agentIds: string[];
  agents: DepartmentAgent[];
}

/** Rejilla del escenario: numero de salas por fila y columna. */
export interface OfficeGrid {
  columns: number;
  rows: number;
}
