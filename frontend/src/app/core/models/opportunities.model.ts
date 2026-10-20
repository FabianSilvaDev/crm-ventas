/** Oportunidades: la cola del intake y el estudio que las respalda. */
import type { Metric, ResourceRef, Severity } from './api.model';

export type OpportunityStatus = 'candidate' | 'approved' | 'discarded';

/**
 * Hipotesis de producto: lo que responde a "acepto la oportunidad, pero ¿que producto es?".
 *
 * `confidence: 'baja'` significa que el sistema solo ha reconocido una CATEGORIA, asi que
 * el producto propuesto es un ejemplo y hay que confirmarlo antes de aprobar.
 */
export type ProductHypothesisStatus = 'proposed' | 'confirmed' | 'category' | 'none';

export interface ProductHypothesis {
  status: ProductHypothesisStatus;
  productId: string | null;
  name: string | null;
  /** En que se basa la propuesta: nombre, palabras en comun, categoria u operador. */
  basis: string | null;
  confidence: 'alta' | 'baja' | null;
  note: string | null;
  decidedAt?: string | null;
}

/** Situacion del producto, en palabras, para preguntarla antes de aprobar. */
export interface ProductSituation {
  level: 'clear' | 'proposed' | 'ambiguous' | 'category' | 'missing';
  text: string;
}

/**
 * Enlace de una oportunidad con el catalogo.
 * Cuando existe, el flujo puede referenciar los registros reales (producto, oferta,
 * landing, campana) en lugar de proponer artefactos derivados.
 */
export interface CatalogLink {
  productId: string;
  productName: string;
  offerId: string | null;
  offerName: string | null;
  landingPageId: string | null;
  landingPageSlug: string | null;
  campaignId: string | null;
  campaignName: string | null;
}

/** Procedencia de un dato: de que fuente salio y en que modo. */
export interface SignalSource {
  id: string;
  name: string;
  /** `public` (datos abiertos), `marketplace`, `supplier`, `simulated` o `none`. */
  kind: string;
  /** `live` cuando es un dato real; `simulated` si es de demostracion; `none` si no hay. */
  mode: 'live' | 'simulated' | 'none';
}

/** Un componente de la puntuacion: una metrica con su valor normalizado y su fuente. */
export interface ScoreComponent {
  keyword: string;
  metric: string;
  metricLabel: string;
  value: number;
  unit: string;
  better: 'higher' | 'lower' | 'neutral';
  confidence: number;
  /** `false` cuando ninguna fuente aporto el dato: el valor es 0 y no puntua. */
  available?: boolean;
  evidence: { note?: string; source?: string; topics?: TopicMatch[]; sample?: unknown[] };
  source: SignalSource;
  collectedAt: string | null;
  /** Valor llevado a 0-1 para poder comparar metricas de escalas distintas. */
  normalized: number | null;
  weight: number;
}

/** Tema de Google Trends al que se resuelve un termino. */
export interface TopicMatch {
  mid: string;
  title: string;
  type: string | null;
  exact: boolean;
}

/** Dato que falta y por que. La ausencia tambien es informacion. */
export interface MissingMetric {
  metric: string;
  label: string;
  reason: string;
}

/** Comprobacion de una restriccion del operador. */
export interface ConstraintCheck {
  constraint: string;
  passed: boolean | null;
  detail: string;
}

export interface OpportunitySnapshot {
  score: number | null;
  /** Proporcion del peso total que se pudo puntuar (0-1). */
  coverage: number;
  confidence: number;
  verdict: string;
  economics: {
    cost: number | null;
    marketPrice: number | null;
    expectedSalePrice: number | null;
    margin: number | null;
    marginAssumed: boolean;
  };
  components: ScoreComponent[];
  missing: MissingMetric[];
  checks: ConstraintCheck[];
  collectedAt: string;
  sourceMode: 'auto' | 'live' | 'simulated';
  geo: string | null;
  timeframe: string | null;
}

export interface OpportunityRevision {
  revision: number;
  at: string;
  score: number | null;
  coverage: number;
  verdict: string;
  margin: number | null;
}

export interface Opportunity {
  id: string;
  slug: string;
  keyword: string;
  status: OpportunityStatus;
  origin: string;
  /** Producto del catalogo al que corresponde el termino, si existe. */
  catalogLink: CatalogLink | null;
  /** Que producto propone el sistema y en que se basa. */
  productHypothesis: ProductHypothesis;
  firstSeenAt: string;
  lastScanAt: string;
  revision: number;
  studyCount: number;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionReason: string | null;
  latest: OpportunitySnapshot;
  revisions: OpportunityRevision[];
}

export interface OpportunitySummary {
  totals: { total: number; candidate: number; approved: number; discarded: number };
  averageScore: number | null;
  byCoverage: { complete: number; partial: number; withoutData: number };
  decisions: {
    id: string;
    keyword: string;
    status: OpportunityStatus;
    at: string;
    by: string;
    reason: string | null;
  }[];
}

/** Estado de una fuente durante una recogida. */
export interface SourceRunStatus {
  id: string;
  name: string;
  mode: 'live' | 'unavailable' | 'simulated' | 'error';
  signals: number;
  durationMs?: number;
  reason?: string;
  hint?: string;
}

export interface ScanNote {
  level: Severity;
  message: string;
  hint?: string;
  topics?: TopicMatch[];
}

export interface ScanCandidate {
  keyword: string;
  score: number | null;
  coverage: number;
  confidence: number;
  verdict: string;
  components: ScoreComponent[];
  missing: MissingMetric[];
  catalogLink: CatalogLink | null;
  productHypothesis: ProductHypothesis;
  economics: OpportunitySnapshot['economics'];
  checks: ConstraintCheck[];
  opportunityId?: string | null;
  opportunityStatus?: OpportunityStatus | null;
}

export interface ScanConstraints {
  minMargin: number;
  maxCost: number | null;
  maxCompetition: number | null;
  expectedSalePrice: number | Record<string, number> | null;
}

export interface ScanResult {
  keywords: string[];
  constraints: ScanConstraints;
  mode: 'auto' | 'live' | 'simulated';
  geo: string;
  timeframe: string;
  collectedAt: string;
  candidates: ScanCandidate[];
  sources: SourceRunStatus[];
  notes: ScanNote[];
  registered: { id: string; keyword: string; status: OpportunityStatus; revision: number }[];
  method: {
    weights: Record<string, number>;
    expectedMetrics: string[];
    defaults: ScanConstraints;
  };
}

/** Termino que esta subiendo segun Google Trends. */
export interface RisingTerm {
  title: string;
  traffic: string | null;
  trafficValue: number | null;
  publishedAt: string | null;
  newsSource: string | null;
  newsTitles: string[];
}

export interface DiscoverResult {
  geo: string;
  collectedAt: string;
  source: SignalSource;
  terms: RisingTerm[];
  /** Advertencia sobre el tipo de contenido que trae el feed. */
  caveat: string | null;
  error: { message: string; hint: string | null } | null;
}

/** Ficha de una fuente de datos, tal como la publica `GET /sources`. */
export interface DataSourceInfo {
  id: string;
  name: string;
  kind: string;
  capabilities: string[];
  requiresCredentials: boolean;
  available: boolean;
  mode: 'live' | 'simulated';
  limitations: string;
  docsUrl?: string;
  unavailableReason?: string | null;
  setupHint?: string;
  method?: string;
  role?: string;
}
