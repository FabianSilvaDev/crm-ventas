/** Productos, ofertas, campanas, leads, contenido, landings e investigacion. */
import type { AccentKey, Metric, ResourceRef } from './api.model';
import type { AgentRef } from './agents.model';

export type ProductStatus = 'researching' | 'validating' | 'validated' | 'live' | 'discarded';
export type OfferStatus = 'draft' | 'ready' | 'active' | 'paused';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'finished';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
export type ContentStatus = 'idea' | 'draft' | 'review' | 'published';
export type CreativeStatus = 'draft' | 'approved' | 'live';
export type LandingStatus = 'draft' | 'published' | 'paused';

export interface ProductRef {
  id: string;
  name: string;
  sku: string;
  category: string;
  status: ProductStatus;
  price: number;
  currency: string;
}

export interface OfferRef {
  id: string;
  name: string;
  status: OfferStatus;
  price: number;
  currency: string;
  productId: string;
}

export interface CampaignRef {
  id: string;
  name: string;
  status: CampaignStatus;
  channels: string[];
}

export interface LandingPageRef {
  id: string;
  slug: string;
  title: string;
  status: LandingStatus;
  conversionRate: number;
}

export interface OfferTier {
  id: string;
  name: string;
  price: number;
  includes: string[];
}

export interface Offer {
  id: string;
  name: string;
  status: OfferStatus;
  positioning: string;
  channel: string;
  price: number;
  currency: string;
  guarantee: string;
  tiers: OfferTier[];
  conversionRate: number;
  product: ProductRef | null;
  createdAt: string;
  /** Solo en el detalle. */
  campaigns?: { id: string; name: string; status: CampaignStatus; revenue: number; roas: number }[];
  landingPages?: { id: string; slug: string; status: LandingStatus; conversionRate: number }[];
  leads?: { total: number; won: number; value: number };
  revenue?: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  status: ProductStatus;
  supplier: string;
  pricing: { cost: number; price: number; currency: string };
  validation: {
    score: number;
    margin: number;
    demandIndex: number;
    competition: string;
    supplyRisk: string;
    verdict: string;
    validatedAt: string | null;
  };
  kpis: {
    unitsSold: number;
    revenue: number;
    returnRate: number;
    rating: number;
    campaignsRevenue: number;
  };
  tags: string[];
  offer: OfferRef | null;
  researchId: string;
  createdAt: string;
  updatedAt: string;
  /** Solo en el detalle. */
  research?: ResearchReport | null;
  campaigns?: { id: string; name: string; status: CampaignStatus; spend: number; revenue: number; roas: number; conversions: number }[];
  landingPages?: { id: string; slug: string; status: LandingStatus; conversionRate: number; visitors: number }[];
  leads?: { total: number; won: number; pipelineValue: number };
  timeline?: { at: string; label: string }[];
}

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpl: number;
  cpa: number;
  roas: number;
  conversionRate: number;
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  status: CampaignStatus;
  channels: string[];
  primaryChannel: string | null;
  budget: { total: number; daily: number; currency: string };
  metrics: CampaignMetrics;
  /** Porcentaje del presupuesto consumido (0-1). */
  pacing: number;
  startDate: string;
  endDate: string;
  offer: OfferRef | null;
  product: ProductRef | null;
  landingPage: LandingPageRef | null;
  agents: AgentRef[];
  leadCount: number;
  /** Solo en el detalle. */
  creatives?: {
    id: string;
    name: string;
    format: string;
    dimensions: { width: number; height: number };
    status: CreativeStatus;
    palette: AccentKey;
    performance: { impressions: number; clicks: number; conversions: number; ctr: number };
  }[];
  audienceIds?: string[];
  leads?: {
    total: number;
    won: number;
    qualified: number;
    averageScore: number;
    sample: { id: string; contact: string; company: string; status: LeadStatus; score: number; value: number }[];
  };
}

export interface LeadTimelineEntry {
  id: string;
  type: string;
  note: string;
  agentId: string | null;
  at: string;
  agent?: AgentRef | null;
}

export interface Lead {
  id: string;
  contact: { name: string; role: string; email: string; phone: string };
  company: { name: string; industry: string; size: string; country: string; city: string };
  campaignId: string;
  offerId: string;
  origin: string;
  status: LeadStatus;
  score: number;
  priority: 'alta' | 'media' | 'baja';
  value: number;
  units: number;
  currency: string;
  ownerAgentId: string;
  nextStep: string;
  createdAt: string;
  lastContactAt: string;
  timeline: LeadTimelineEntry[];
  tags: string[];
  reachedGoal: boolean;
  product: ProductRef | null;
  offer: OfferRef | null;
  campaign: CampaignRef | null;
  ownerAgent: AgentRef | null;
  daysSinceCreation: number;
  /** Solo en el detalle. */
  productDetail?: Product | null;
}

export interface ContentPiece {
  id: string;
  title: string;
  type: string;
  channel: string;
  status: ContentStatus;
  keywords: string[];
  wordCount: number;
  publishedAt: string | null;
  performance: { impressions: number; clicks: number; conversions: number; ctr: number };
  author: AgentRef | null;
  offer: OfferRef | null;
  product: ProductRef | null;
}

export interface Creative {
  id: string;
  name: string;
  format: string;
  dimensions: { width: number; height: number };
  status: CreativeStatus;
  palette: AccentKey;
  variants: number;
  performance: { impressions: number; clicks: number; conversions: number; ctr: number };
  author: AgentRef | null;
  reviewer: AgentRef | null;
  campaign: CampaignRef | null;
  offer: OfferRef | null;
  createdAt: string;
}

export interface LandingVariant {
  id: string;
  name: string;
  weight: number;
  visitors: number;
  conversions: number;
  conversionRate: number;
}

export interface LandingPage {
  id: string;
  slug: string;
  title: string;
  status: LandingStatus;
  template: string;
  sections: string[];
  performance: {
    visitors: number;
    conversions: number;
    conversionRate: number;
    bounceRate: number;
    avgTimeSeconds: number;
  };
  technical: { lcpMs: number; cls: number; seoScore: number; mobileScore: number };
  variants: LandingVariant[];
  winner: LandingVariant | null;
  owner: AgentRef | null;
  offer: OfferRef | null;
  product: ProductRef | null;
  campaignCount: number;
  createdAt: string;
  updatedAt: string;
  /** Solo en el detalle. */
  campaigns?: { id: string; name: string; status: CampaignStatus; channels: string[]; revenue: number; roas: number }[];
  experiment?: ExperimentResult | null;
  leads?: { total: number; won: number; value: number };
}

export interface ExperimentResult {
  landingPageId: string;
  slug: string;
  winner: { id: string; name: string; conversionRate: number };
  runnerUp: { id: string; name: string; conversionRate: number } | null;
  lift: number;
}

export interface Competitor {
  name: string;
  price: number;
  strength: string;
  gap: string;
}

export interface ResearchReport {
  id: string;
  title: string;
  type: string;
  summary: string;
  status: 'draft' | 'published';
  publishedAt: string;
  metrics: Metric[];
  author: AgentRef | null;
  product: ProductRef | null;
  findingCount: number;
  sourceCount: number;
  /** `demo` (escrito a mano) o `run` (generado consultando las fuentes en una ejecucion). */
  origin: 'demo' | 'run';
  /** Lo que no se pudo conseguir, dicho sin rodeos. */
  limitations: string[];
  /** Oportunidad que origino el informe, si se genero en una ejecucion. */
  opportunityId: string | null;
  sourceMode: string | null;
  /** Solo en el detalle. */
  findings?: string[];
  sources?: { title: string; type: string }[];
  competitors?: Competitor[];
  series?: { label: string; value: number }[];
  /** Procedencia completa de cada cifra (informes generados). */
  signals?: unknown[];
  collectedAt?: string;
}

/** Referencias que devuelve el backend para enlazar desde otros modulos. */
export interface ResourceLink {
  ref: ResourceRef;
}
