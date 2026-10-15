/**
 * Calculos compartidos por el dashboard y la analitica.
 *
 * Todo se deriva de los mismos datos simulados, de modo que dos vistas nunca
 * muestran cifras contradictorias (seccion 13 del prompt). Cuando un dato no existe
 * como serie (por ejemplo, la distribucion diaria de ingresos de una campana), se
 * reconstruye con una semilla fija y se documenta como simulacion.
 */
import { campaigns, landingPages, leads, offers, products } from '../mocks/index.js';
import { store } from '../store.js';
import { DAY_MS, DEMO_REFERENCE_MS } from '../utils/time.js';
import { createRandom, seedFrom } from '../utils/random.js';

const sum = (items, selector) => items.reduce((total, item) => total + selector(item), 0);
const round = (value, decimals = 2) => Number(value.toFixed(decimals));

const shortDate = (ms) =>
  new Date(ms).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', timeZone: 'UTC' });

export const leadsByStatus = () => {
  const counts = Object.fromEntries(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'].map((status) => [status, 0]));
  for (const lead of leads) counts[lead.status] += 1;
  return counts;
};

export const leadsByOrigin = () => {
  const counts = {};
  for (const lead of leads) counts[lead.origin] = (counts[lead.origin] ?? 0) + 1;
  return Object.entries(counts).map(([origin, value]) => ({ label: origin, value }));
};

export const leadTotals = () => {
  const byStatus = leadsByStatus();
  const won = leads.filter((lead) => lead.status === 'won');
  const open = leads.filter((lead) => ['new', 'contacted', 'qualified', 'proposal'].includes(lead.status));
  const lost = leads.filter((lead) => lead.status === 'lost');

  return {
    total: leads.length,
    byStatus,
    won: won.length,
    lost: lost.length,
    open: open.length,
    pipelineValue: sum(open, (lead) => lead.value),
    wonValue: sum(won, (lead) => lead.value),
    averageScore: leads.length === 0 ? 0 : round(sum(leads, (lead) => lead.score) / leads.length, 1),
    conversionRate: leads.length === 0 ? 0 : round(won.length / leads.length, 4),
    highPriority: leads.filter((lead) => lead.priority === 'alta').length,
  };
};

/** La atribucion usa el canal principal (el primero declarado) de cada campana. */
export const campaignTotals = () => {
  const totals = {
    budget: sum(campaigns, (campaign) => campaign.budget.total),
    spend: sum(campaigns, (campaign) => campaign.metrics.spend),
    impressions: sum(campaigns, (campaign) => campaign.metrics.impressions),
    clicks: sum(campaigns, (campaign) => campaign.metrics.clicks),
    leads: sum(campaigns, (campaign) => campaign.metrics.leads),
    conversions: sum(campaigns, (campaign) => campaign.metrics.conversions),
    revenue: sum(campaigns, (campaign) => campaign.metrics.revenue),
  };

  return {
    ...totals,
    active: campaigns.filter((campaign) => campaign.status === 'active').length,
    paused: campaigns.filter((campaign) => campaign.status === 'paused').length,
    scheduled: campaigns.filter((campaign) => campaign.status === 'scheduled').length,
    finished: campaigns.filter((campaign) => campaign.status === 'finished').length,
    total: campaigns.length,
    ctr: totals.impressions === 0 ? 0 : round(totals.clicks / totals.impressions, 4),
    cpc: totals.clicks === 0 ? 0 : round(totals.spend / totals.clicks),
    cpl: totals.leads === 0 ? 0 : round(totals.spend / totals.leads),
    cpa: totals.conversions === 0 ? 0 : round(totals.spend / totals.conversions),
    roas: totals.spend === 0 ? 0 : round(totals.revenue / totals.spend),
    budgetPacing: totals.budget === 0 ? 0 : round(totals.spend / totals.budget, 4),
  };
};

export const campaignTotalsByChannel = () => {
  const channels = {};
  for (const campaign of campaigns) {
    const channel = campaign.channels[0] ?? 'otros';
    const entry = channels[channel] ?? { label: channel, spend: 0, revenue: 0, conversions: 0, leads: 0 };
    entry.spend += campaign.metrics.spend;
    entry.revenue += campaign.metrics.revenue;
    entry.conversions += campaign.metrics.conversions;
    entry.leads += campaign.metrics.leads;
    channels[channel] = entry;
  }

  return Object.values(channels)
    .map((entry) => ({ ...entry, roas: entry.spend === 0 ? 0 : round(entry.revenue / entry.spend) }))
    .sort((a, b) => b.revenue - a.revenue);
};

export const productTotals = () => ({
  total: products.length,
  live: products.filter((product) => product.status === 'live').length,
  validated: products.filter((product) => product.status === 'validated').length,
  validating: products.filter((product) => product.status === 'validating').length,
  researching: products.filter((product) => product.status === 'researching').length,
  offers: offers.length,
  activeOffers: offers.filter((offer) => offer.status === 'active').length,
  unitsSold: sum(products, (product) => product.kpis.unitsSold),
  catalogRevenue: sum(products, (product) => product.kpis.revenue),
  averageMargin: round(sum(products, (product) => product.validation.margin) / products.length, 4),
  averageScore: round(sum(products, (product) => product.validation.score) / products.length, 1),
});

export const landingTotals = () => {
  const published = landingPages.filter((page) => page.status === 'published');
  return {
    total: landingPages.length,
    published: published.length,
    draft: landingPages.filter((page) => page.status === 'draft').length,
    visitors: sum(landingPages, (page) => page.performance.visitors),
    conversions: sum(landingPages, (page) => page.performance.conversions),
    conversionRate:
      sum(landingPages, (page) => page.performance.visitors) === 0
        ? 0
        : round(
            sum(landingPages, (page) => page.performance.conversions) /
              sum(landingPages, (page) => page.performance.visitors),
            4,
          ),
  };
};

/** Carga de trabajo por departamento, con el reparto de estados de sus agentes. */
export const departmentWorkload = () => {
  const byDepartment = new Map();
  for (const agent of store.agents) {
    const entry = byDepartment.get(agent.departmentId) ?? {
      departmentId: agent.departmentId,
      agents: 0,
      active: 0,
      idle: 0,
      error: 0,
      tasksCompleted: 0,
    };
    entry.agents += 1;
    if (['working', 'thinking', 'collaborating'].includes(agent.status)) entry.active += 1;
    if (['idle', 'offline'].includes(agent.status)) entry.idle += 1;
    if (agent.status === 'error') entry.error += 1;
    entry.tasksCompleted += agent.stats.tasksCompleted;
    byDepartment.set(agent.departmentId, entry);
  }
  return [...byDepartment.values()];
};

/** Serie diaria de leads creados en los ultimos `days` dias (fechas de la demo). */
export const leadsSeries = (days = 14) => {
  const series = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const dayStart = DEMO_REFERENCE_MS - index * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const value = leads.filter((lead) => {
      const createdAt = new Date(lead.createdAt).getTime();
      return createdAt >= dayStart && createdAt < dayEnd;
    }).length;
    series.push({ label: shortDate(dayStart), date: new Date(dayStart).toISOString(), value });
  }
  return series;
};

/**
 * Serie diaria simulada de ingresos y gasto.
 * La campana no guarda detalle diario, asi que se reparte su total con una semilla
 * fija y un patron de fin de semana: reproducible y coherente con los totales.
 */
export const revenueSeries = (days = 14) => {
  const totals = campaignTotals();
  const random = createRandom(seedFrom(`revenue-series:${days}`));
  const weights = Array.from({ length: days }, (_, index) => {
    const dayStart = DEMO_REFERENCE_MS - (days - 1 - index) * DAY_MS;
    const weekday = new Date(dayStart).getUTCDay();
    const weekendFactor = weekday === 0 || weekday === 6 ? 0.72 : 1;
    return (0.8 + random.next() * 0.4) * weekendFactor;
  });
  const weightTotal = weights.reduce((total, weight) => total + weight, 0);

  return weights.map((weight, index) => {
    const dayStart = DEMO_REFERENCE_MS - (days - 1 - index) * DAY_MS;
    const share = weightTotal === 0 ? 0 : weight / weightTotal;
    return {
      label: shortDate(dayStart),
      date: new Date(dayStart).toISOString(),
      revenue: Math.round(totals.revenue * share),
      spend: Math.round(totals.spend * share),
      conversions: Math.round(totals.conversions * share),
    };
  });
};

/** Ranking de campanas por retorno, ya calculado por `deriveMetrics`. */
export const campaignRanking = (limit = 5) =>
  [...campaigns]
    .filter((campaign) => campaign.metrics.spend > 0)
    .sort((a, b) => b.metrics.roas - a.metrics.roas)
    .slice(0, limit)
    .map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      channel: campaign.channels[0] ?? 'otros',
      status: campaign.status,
      spend: campaign.metrics.spend,
      revenue: campaign.metrics.revenue,
      roas: campaign.metrics.roas,
      conversions: campaign.metrics.conversions,
      cpa: campaign.metrics.cpa,
    }));

/** Productos ordenados por ingresos simulados. */
export const productRanking = (limit = 5) =>
  [...products]
    .sort((a, b) => b.kpis.revenue - a.kpis.revenue)
    .slice(0, limit)
    .map((product) => ({
      id: product.id,
      name: product.name,
      status: product.status,
      unitsSold: product.kpis.unitsSold,
      revenue: product.kpis.revenue,
      margin: product.validation.margin,
      score: product.validation.score,
      rating: product.kpis.rating,
    }));

/** Resultado de los experimentos A/B de las landings publicadas. */
export const experimentResults = () =>
  landingPages
    .filter((page) => page.variants.length > 1 && page.performance.visitors > 0)
    .map((page) => {
      const [first, ...rest] = [...page.variants].sort((a, b) => b.conversionRate - a.conversionRate);
      const runnerUp = rest[0];
      return {
        landingPageId: page.id,
        slug: page.slug,
        winner: { id: first.id, name: first.name, conversionRate: first.conversionRate },
        runnerUp: runnerUp ? { id: runnerUp.id, name: runnerUp.name, conversionRate: runnerUp.conversionRate } : null,
        lift:
          runnerUp && runnerUp.conversionRate > 0
            ? round((first.conversionRate - runnerUp.conversionRate) / runnerUp.conversionRate, 4)
            : 0,
      };
    });
