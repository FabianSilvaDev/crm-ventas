/**
 * Campanas simuladas (publicidad ficticia, cifras de demostracion).
 * Los indicadores derivados (CTR, CPC, CPA, ROAS) se calculan en `deriveMetrics`
 * para que nunca se contradigan entre vistas.
 */
import { isoDaysAgo, isoDaysFromNow } from '../utils/time.js';

export const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'active', 'paused', 'finished'];

const round = (value, decimals = 2) => Number(value.toFixed(decimals));

/** Calcula los indicadores derivados de una campana a partir de sus totales. */
export const deriveMetrics = (campaign) => {
  const { impressions, clicks, leads, conversions, spend, revenue } = campaign.metrics;
  return {
    ctr: impressions > 0 ? round(clicks / impressions, 4) : 0,
    cpc: clicks > 0 ? round(spend / clicks) : 0,
    cpl: leads > 0 ? round(spend / leads) : 0,
    cpa: conversions > 0 ? round(spend / conversions) : 0,
    roas: spend > 0 ? round(revenue / spend) : 0,
    conversionRate: clicks > 0 ? round(conversions / clicks, 4) : 0,
  };
};

const campaign = (data) => ({
  ...data,
  metrics: { ...data.metrics, ...deriveMetrics(data) },
});

export const campaigns = [
  campaign({
    id: 'cmp-0001',
    name: 'Vuelta a la oficina',
    objective: 'Captacion de leads cualificados',
    status: 'active',
    offerId: 'off-0001',
    productId: 'prd-001',
    landingPageId: 'lp-0001',
    channels: ['busqueda', 'social', 'display'],
    audienceIds: ['aud-remote-pros', 'aud-small-studios', 'aud-creators', 'aud-returning'],
    creativeIds: ['crv-0001', 'crv-0002', 'crv-0003'],
    agentIds: ['agt-013', 'agt-014', 'agt-001'],
    startDate: isoDaysAgo(18),
    endDate: isoDaysFromNow(12),
    budget: { total: 6400, daily: 210, currency: 'EUR' },
    metrics: {
      impressions: 486_200,
      clicks: 12_480,
      leads: 762,
      conversions: 236,
      spend: 5_812,
      revenue: 19_744,
    },
  }),
  campaign({
    id: 'cmp-0002',
    name: 'Aurora Pro',
    objective: 'Lanzamiento de producto',
    status: 'active',
    offerId: 'off-0002',
    productId: 'prd-002',
    landingPageId: 'lp-0002',
    channels: ['social', 'display'],
    audienceIds: ['aud-creators', 'aud-remote-pros'],
    creativeIds: ['crv-0004', 'crv-0005'],
    agentIds: ['agt-013', 'agt-011'],
    startDate: isoDaysAgo(11),
    endDate: isoDaysFromNow(19),
    budget: { total: 3800, daily: 125, currency: 'EUR' },
    metrics: {
      impressions: 302_100,
      clicks: 7_860,
      leads: 418,
      conversions: 121,
      spend: 3_244,
      revenue: 10_164,
    },
  }),
  campaign({
    id: 'cmp-0003',
    name: 'Norte Ergo Q4',
    objective: 'Ventas de ticket alto',
    status: 'active',
    offerId: 'off-0003',
    productId: 'prd-003',
    landingPageId: 'lp-0003',
    channels: ['display', 'busqueda'],
    audienceIds: ['aud-small-studios', 'aud-returning'],
    creativeIds: ['crv-0006'],
    agentIds: ['agt-013', 'agt-014'],
    startDate: isoDaysAgo(26),
    endDate: isoDaysFromNow(4),
    budget: { total: 5200, daily: 160, currency: 'EUR' },
    metrics: {
      impressions: 214_700,
      clicks: 4_120,
      leads: 196,
      conversions: 58,
      spend: 4_918,
      revenue: 20_242,
    },
  }),
  campaign({
    id: 'cmp-0004',
    name: 'Halo Focus organico asistido',
    objective: 'Trafico organico',
    status: 'active',
    offerId: 'off-0005',
    productId: 'prd-005',
    landingPageId: 'lp-0004',
    channels: ['organico'],
    audienceIds: ['aud-remote-pros'],
    creativeIds: ['crv-0007'],
    agentIds: ['agt-009', 'agt-010'],
    startDate: isoDaysAgo(5),
    endDate: isoDaysFromNow(40),
    budget: { total: 900, daily: 30, currency: 'EUR' },
    metrics: {
      impressions: 88_400,
      clicks: 5_260,
      leads: 288,
      conversions: 96,
      spend: 412,
      revenue: 6_144,
    },
  }),
  campaign({
    id: 'cmp-0005',
    name: 'Altura Plus preventa',
    objective: 'Validacion de demanda',
    status: 'scheduled',
    offerId: 'off-0004',
    productId: 'prd-004',
    landingPageId: 'lp-0005',
    channels: ['busqueda'],
    audienceIds: ['aud-small-studios'],
    creativeIds: [],
    agentIds: ['agt-005', 'agt-013'],
    startDate: isoDaysFromNow(6),
    endDate: isoDaysFromNow(34),
    budget: { total: 2400, daily: 80, currency: 'EUR' },
    metrics: {
      impressions: 0,
      clicks: 0,
      leads: 0,
      conversions: 0,
      spend: 0,
      revenue: 0,
    },
  }),
  campaign({
    id: 'cmp-0006',
    name: 'Remarketing Setup Estudio',
    objective: 'Recuperacion de carrito',
    status: 'finished',
    offerId: 'off-0001',
    productId: 'prd-001',
    landingPageId: 'lp-0001',
    channels: ['social', 'display'],
    audienceIds: ['aud-returning'],
    creativeIds: ['crv-0003'],
    agentIds: ['agt-013'],
    startDate: isoDaysAgo(47),
    endDate: isoDaysAgo(12),
    budget: { total: 1800, daily: 55, currency: 'EUR' },
    metrics: {
      impressions: 96_300,
      clicks: 4_180,
      leads: 142,
      conversions: 74,
      spend: 1_742,
      revenue: 9_546,
    },
  }),
];

export const campaignById = new Map(campaigns.map((item) => [item.id, item]));
