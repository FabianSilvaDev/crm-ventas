/** Flujo de agentes: catalogo de etapas, definicion de flujos y ejecuciones. */
import type { Metric } from './api.model';
import type { AgentRef, DepartmentRef } from './agents.model';
import type { CatalogLink } from './opportunities.model';

export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'blocked';
export type RunStatus = 'ready' | 'running' | 'paused' | 'awaiting_approval' | 'completed' | 'failed' | 'rejected';

/**
 * Puerta de decision declarada en una etapa.
 * El flujo se detiene al llegar a ella y espera al operador.
 */
export interface StageGate {
  kind: 'kill' | 'budget' | 'launch';
  question: string;
  detail: string;
  approveLabel: string;
  rejectLabel: string;
}

/** Puerta abierta en una ejecucion concreta. */
export interface RunGate extends StageGate {
  stageKey: string;
  stageName: string;
  openedAt: string;
  preview: StageResult | null;
}

/** Motivo por el que el operador detuvo el ciclo en una puerta. */
export interface RunRejection {
  stageKey: string;
  stageName: string;
  kind: string;
  reason: string | null;
  at: string;
}

/**
 * Artefacto que produce una etapa.
 * `derived: true` significa que NO existe como registro: es una propuesta construida a
 * partir del estudio de la oportunidad, y la interfaz no debe presentarla como si
 * estuviera en el catalogo.
 */
export interface RunArtifact {
  type: string;
  id: string;
  label: string | null;
  derived?: boolean;
}

/** Contexto de una ejecucion nacida de una oportunidad aprobada. */
export interface RunContext {
  opportunityId: string;
  keyword: string;
  slug: string;
  catalogLink: CatalogLink | null;
}

/** Resultado previsto o ya producido por una etapa. */
export interface StageResult {
  summary: string;
  metrics: Metric[];
  artifacts: RunArtifact[];
  completedAt?: string;
  durationMs?: number;
}

/** Etapa perteneciente al catalogo de un flujo. */
export interface WorkflowStage {
  key: string;
  order: number;
  name: string;
  summary: string;
  description: string;
  deliverables: string[];
  inputs: string[];
  dependsOn: string[];
  estimatedMinutes: number;
  department: DepartmentRef | null;
  agents: AgentRef[];
  agentIds: string[];
  /** Puerta de decision de la etapa, o `null` si no la tiene. */
  gate: StageGate | null;
  expectedOutcome: StageResult;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  goal: string;
  tags: string[];
  estimatedMinutes: number;
  runsCompleted: number;
  successRate: number;
  ownerAgent: AgentRef | null;
  stageCount: number;
  stageKeys: string[];
  activeRuns: number;
  stages?: WorkflowStage[];
}

/** Etapa dentro de una ejecucion concreta. */
export interface RunStage {
  key: string;
  order: number;
  name: string;
  summary: string;
  description: string;
  deliverables: string[];
  inputs: string[];
  dependsOn: string[];
  estimatedMinutes: number;
  department: DepartmentRef | null;
  agents: AgentRef[];
  agentIds: string[];
  /** Puerta de decision de la etapa: la vista marca donde habra que decidir. */
  gate: StageGate | null;
  status: StageStatus;
  progress: number;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number;
  result: StageResult | null;
  error: string | null;
}

export interface RunEvent {
  id: string;
  at: string;
  type: string;
  message: string;
  stageKey: string | null;
}

export interface RunSummary {
  totalStages: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  /** Progreso global (0-1), contando la etapa en curso. */
  progress: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
}

export interface WorkflowRun {
  runId: string;
  workflowId: string;
  workflowName: string;
  workflowGoal: string;
  ownerAgent: AgentRef | null;
  status: RunStatus;
  demo: boolean;
  /** Oportunidad que origina la ejecucion, o `null` si es la demostracion pura. */
  context: RunContext | null;
  /** Puerta de decision abierta, si el flujo esta esperando al operador. */
  gate: RunGate | null;
  /** Etapas cuya puerta ya se aprobo en esta ejecucion. */
  approvedGates: string[];
  /** Motivo del rechazo, si el operador detuvo el ciclo. */
  rejection: RunRejection | null;
  createdAt: string;
  startedAt: string;
  finishedAt: string | null;
  stepMs: number;
  currentStageKey: string | null;
  stages: RunStage[];
  events: RunEvent[];
  summary: RunSummary;
}

/** Accion de control disponible sobre una ejecucion. */
export type RunAction = 'pause' | 'resume' | 'reset';
