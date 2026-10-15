/** Dashboard, analitica, actividad, notificaciones, ajustes y health. */
import type { Metric, ResourceRef, Severity } from './api.model';
import type { AgentAvatar, AgentRef, AgentStatus, DepartmentRef } from './agents.model';
import type { ExperimentResult, LeadStatus, ProductStatus } from './catalog.model';

/** Serie temporal simple de un grafico. */
export interface SeriesPoint {
  label: string;
  date: string;
  value: number;
}

/** Punto de la serie de ingresos, con gasto y conversiones del mismo dia. */
export interface RevenuePoint {
  label: string;
  date: string;
  revenue: number;
  spend: number;
  conversions: number;
}

export interface ChannelTotal {
  label: string;
  spend: number;
  revenue: number;
  conversions: number;
  leads: number;
  roas: number;
}

export interface CampaignRankingRow {
  id: string;
  name: string;
  channel: string;
  status: string;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  cpa: number;
}

export interface ProductRankingRow {
  id: string;
  name: string;
  status: ProductStatus;
  unitsSold: number;
  revenue: number;
  margin: number;
  score: number;
  rating: number;
}

export interface DepartmentWorkload {
  departmentId: string;
  agents: number;
  active: number;
  idle: number;
  error: number;
  tasksCompleted: number;
}

/** Senal de salud de la operacion. */
export interface HealthSignal {
  level: Severity;
  label: string;
  detail: string;
  link: string;
}

export interface OperationHealth {
  score: number;
  label: string;
  signals: HealthSignal[];
}

/** Tarea reciente mostrada en el dashboard (de agente o de etapa de flujo). */
export interface LatestTask {
  id: string;
  kind: 'agent-task' | 'workflow-stage';
  title: string;
  agentId: string | null;
  agentName: string | null;
  department: DepartmentRef | null;
  status: string;
  progress: number;
  at: string;
  runId?: string;
  workflowName?: string;
}

export interface DashboardKpis {
  agents: { total: number; active: number; byStatus: Record<AgentStatus, number> };
  workflows: { templates: number; running: number; paused: number; completed: number; failed: number };
  products: { total: number; validated: number; researching: number; catalogRevenue: number };
  campaigns: { total: number; active: number; spend: number; revenue: number; roas: number };
  leads: { total: number; open: number; won: number; conversionRate: number; pipelineValue: number };
  conversions: { total: number; landingRate: number; cpa: number };
  revenue: { simulated: number; currency: string; note: string };
}

export interface Dashboard {
  kpis: DashboardKpis;
  operationHealth: OperationHealth;
  charts: {
    leadsSeries: SeriesPoint[];
    revenueSeries: RevenuePoint[];
    departmentWorkload: DepartmentWorkload[];
    campaignRanking: CampaignRankingRow[];
    leadFunnel: Record<LeadStatus, number>;
  };
  recentActivity: ActivityEvent[];
  latestTasks: LatestTask[];
  demo: {
    referenceDate: string | null;
    simulation: { stepMs: number; taskMs: number; failureRate: number; pollIntervalMs: number };
  };
}

export interface FunnelStep {
  key: string;
  label: string;
  value: number;
  stepRate: number;
}

export interface AnalyticsInsight {
  level: Severity;
  title: string;
  detail: string;
}

export interface LeadTotals {
  total: number;
  byStatus: Record<LeadStatus, number>;
  won: number;
  lost: number;
  open: number;
  pipelineValue: number;
  wonValue: number;
  averageScore: number;
  conversionRate: number;
  highPriority: number;
}

export interface Analytics {
  range: number;
  overview: {
    revenue: number;
    spend: number;
    roas: number;
    conversions: number;
    cpa: number;
    leads: number;
    cpl: number;
    ctr: number;
    budgetPacing: number;
    currency: string;
  };
  funnel: FunnelStep[];
  timeseries: { revenue: RevenuePoint[]; leads: SeriesPoint[] };
  channels: ChannelTotal[];
  origins: { label: string; value: number }[];
  products: ProductRankingRow[];
  campaigns: CampaignRankingRow[];
  experiments: ExperimentResult[];
  leads: LeadTotals;
  productsSummary: {
    total: number;
    live: number;
    validated: number;
    validating: number;
    researching: number;
    offers: number;
    activeOffers: number;
    unitsSold: number;
    catalogRevenue: number;
    averageMargin: number;
    averageScore: number;
  };
  landing: {
    total: number;
    published: number;
    draft: number;
    visitors: number;
    conversions: number;
    conversionRate: number;
  };
  agents: {
    summary: { total: number; active: number; byStatus: Record<AgentStatus, number> };
    workload: DepartmentWorkload[];
  };
  insights: AnalyticsInsight[];
}

/** Evento del feed de actividad, ya resuelto por el backend. */
export interface ActivityEvent {
  id: string;
  at: string;
  type: string;
  severity: Severity;
  message: string;
  actor: AgentRef | null;
  department: DepartmentRef | null;
  refs: ResourceRef[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  level: Severity;
  at: string;
  read: boolean;
  link: string | null;
  linkLabel: string | null;
}

export interface Integration {
  id: string;
  name: string;
  category: string;
  status: 'disabled' | 'simulated' | 'connected';
  description: string;
}

export interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

export interface Settings {
  workspace: {
    id: string;
    name: string;
    plan: string;
    timezone: string;
    locale: string;
    currency: string;
    demo: boolean;
  };
  profile: {
    id: string;
    name: string;
    role: string;
    email: string;
    initials: string;
    avatar: AgentAvatar;
    lastLoginAt: string;
  };
  simulation: {
    stepMs: number;
    taskMs: number;
    tickMs: number;
    failureRate: number;
    maxRuns: number;
    pollIntervalMs: number;
  };
  dataPolicy: { inMemory: boolean; persistent: boolean; note: string };
  integrations: Integration[];
  featureFlags: FeatureFlag[];
  runtime: {
    nodeEnv: string;
    apiPrefix: string;
    version: string;
    corsOrigins: string[];
    uptimeSeconds: number;
    activeRuns: number;
    activeTimers: number;
    inMemoryRuns: number;
    inMemoryTasks: number;
  };
}

export interface ApiHealth {
  status: string;
  service: string;
  version: string;
  nodeEnv: string;
  node: string;
  demoMode: boolean;
  uptimeSeconds: number;
  timestamp: string;
  simulation: { stepMs: number; taskMs: number; failureRate: number; pollIntervalMs: number };
  inMemory: {
    agents: number;
    activityEvents: number;
    runs: number;
    agentTasks: number;
    timers: number;
  };
  memoryUsageMb: number;
}

/** Resultado de un resumen agregado (usado por varias vistas). */
export interface SummaryPayload {
  totals: Record<string, number>;
  metrics?: Metric[];
}
