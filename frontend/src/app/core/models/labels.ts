/**
 * Etiquetas en espanol para los valores que la API devuelve en ingles.
 *
 * La API mantiene claves estables e independientes del idioma; la traduccion vive
 * aqui, en un unico sitio, para que ninguna vista duplique textos ni invente
 * variantes distintas del mismo estado.
 */
import type { AccentKey, Severity } from './api.model';
import type { AgentStatus } from './agents.model';
import type {
  CampaignStatus,
  ContentStatus,
  CreativeStatus,
  LandingStatus,
  LeadStatus,
  OfferStatus,
  ProductStatus,
} from './catalog.model';
import type { RunStatus, StageStatus } from './workflows.model';

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  idle: 'Inactivo',
  working: 'Trabajando',
  thinking: 'Pensando',
  collaborating: 'Colaborando',
  completed: 'Completado',
  error: 'Error',
  offline: 'Fuera de linea',
};

/**
 * Tono con el que se pinta cada estado de agente.
 * Siempre va acompanado de la etiqueta de texto: el color nunca es el unico canal.
 */
export const AGENT_STATUS_TONE: Record<AgentStatus, string> = {
  idle: 'chip--neutral',
  working: 'chip--info',
  thinking: 'chip--info',
  collaborating: 'chip--info',
  completed: 'chip--good',
  error: 'chip--critical',
  offline: 'chip--warning',
};

/** Glifo de 7x7 px por estado, dibujado como SVG (nunca color solo). */
export const AGENT_STATUS_GLYPH: Record<AgentStatus, string> = {
  idle: 'square',
  working: 'play',
  thinking: 'dots',
  collaborating: 'link',
  completed: 'check',
  error: 'cross',
  offline: 'slash',
};

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  pending: 'Pendiente',
  running: 'En curso',
  completed: 'Completada',
  failed: 'Fallida',
  skipped: 'Omitida',
  blocked: 'Esperando decision',
};

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  ready: 'Lista',
  running: 'En ejecucion',
  paused: 'Pausada',
  awaiting_approval: 'Esperando tu decision',
  completed: 'Completada',
  failed: 'Fallida',
  rejected: 'Detenida por ti',
};

/** Estado de una tarea ejecutada sobre un agente. */
export type TaskStatus = 'running' | 'completed' | 'error';

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  running: 'En curso',
  completed: 'Completada',
  error: 'Fallida',
};

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  researching: 'En investigacion',
  validating: 'En validacion',
  validated: 'Validado',
  live: 'En venta',
  discarded: 'Descartado',
};

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  draft: 'Borrador',
  ready: 'Lista',
  active: 'Activa',
  paused: 'Pausada',
};

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  active: 'Activa',
  paused: 'Pausada',
  finished: 'Finalizada',
};

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  qualified: 'Cualificado',
  proposal: 'Propuesta',
  won: 'Ganado',
  lost: 'Perdido',
};

export const LEAD_STATUS_TONE: Record<LeadStatus, string> = {
  new: 'chip--info',
  contacted: 'chip--info',
  qualified: 'chip--info',
  proposal: 'chip--warning',
  won: 'chip--good',
  lost: 'chip--neutral',
};

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  idea: 'Idea',
  draft: 'Borrador',
  review: 'En revision',
  published: 'Publicado',
};

export const CREATIVE_STATUS_LABEL: Record<CreativeStatus, string> = {
  draft: 'Borrador',
  approved: 'Aprobada',
  live: 'En campana',
};

export const LANDING_STATUS_LABEL: Record<LandingStatus, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  paused: 'Pausada',
};

/** Estado de una oportunidad en la cola del intake. */
export type OpportunityStatusLabel = 'candidate' | 'approved' | 'discarded';

export const OPPORTUNITY_STATUS_LABEL: Record<OpportunityStatusLabel, string> = {
  candidate: 'Candidata',
  approved: 'Aprobada',
  discarded: 'Descartada',
};

export const OPPORTUNITY_STATUS_TONE: Record<OpportunityStatusLabel, string> = {
  candidate: 'chip--info',
  approved: 'chip--good',
  discarded: 'chip--neutral',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  info: 'Informacion',
  success: 'Correcto',
  warning: 'Aviso',
  error: 'Error',
};

export const SEVERITY_TONE: Record<Severity, string> = {
  info: 'chip--info',
  success: 'chip--good',
  warning: 'chip--warning',
  error: 'chip--critical',
};

/** Nombre en espanol de los tipos de etapa y de documento. */
export const STAGE_LABEL_OVERRIDE: Record<string, string> = {
  opportunity: 'Oportunidad',
  research: 'Investigacion',
  'market-intelligence': 'Inteligencia de mercado',
  'competitor-analysis': 'Analisis de competencia',
  'product-validation': 'Validacion de producto',
  'offer-creation': 'Creacion de oferta',
  'content-generation': 'Generacion de contenido',
  'creative-production': 'Produccion creativa',
  'landing-page': 'Landing page',
  'campaign-setup': 'Configuracion de campana',
  'audience-budget': 'Audiencia y presupuesto',
  'lead-acquisition': 'Captacion de leads',
  'lead-qualification': 'Cualificacion de leads',
  'sales-follow-up': 'Seguimiento comercial',
  analytics: 'Analitica',
  optimization: 'Optimizacion',
  learning: 'Aprendizaje',
};

export const RESEARCH_TYPE_LABEL: Record<string, string> = {
  market: 'Mercado',
  trends: 'Tendencias',
  competitors: 'Competencia',
  validation: 'Validacion',
};

export const CONTENT_TYPE_LABEL: Record<string, string> = {
  blog: 'Articulo',
  social: 'Redes',
  email: 'Email',
  'ad-copy': 'Anuncio',
  guia: 'Guia',
};

export const CHANNEL_LABEL: Record<string, string> = {
  busqueda: 'Busqueda',
  social: 'Social',
  display: 'Display',
  organico: 'Organico',
  referido: 'Referido',
  email: 'Email',
  web: 'Web',
};

export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  opportunity_registered: 'Oportunidad registrada',
  task_started: 'Tarea iniciada',
  task_completed: 'Tarea completada',
  task_failed: 'Tarea fallida',
  workflow_stage: 'Etapa de flujo',
  workflow_completed: 'Flujo completado',
  workflow_paused: 'Flujo pausado',
  workflow_resumed: 'Flujo reanudado',
  workflow_reset: 'Flujo reiniciado',
  collaboration: 'Colaboracion',
  content_published: 'Contenido publicado',
  lead_qualified: 'Lead cualificado',
  metric: 'Metrica',
  optimization: 'Optimizacion',
  budget: 'Presupuesto',
};

/** Nombre legible del acento de un departamento (para leyendas y etiquetas). */
export const ACCENT_LABEL: Record<AccentKey, string> = {
  amber: 'Ambar',
  cyan: 'Cian',
  violet: 'Violeta',
  pink: 'Rosa',
  green: 'Verde',
  orange: 'Naranja',
  lime: 'Lima',
  blue: 'Azul',
};

/** Valor por defecto cuando la API devuelve un estado no contemplado. */
export const labelOf = (map: Record<string, string>, key: string | null | undefined, fallback = '—') =>
  key && map[key] ? map[key] : fallback;
