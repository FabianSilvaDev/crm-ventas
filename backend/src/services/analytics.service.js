/**
 * Servicio de analitica: embudo, atribucion por canal, rendimiento por producto y
 * experimentos. Solo agrega datos existentes; no genera metricas nuevas salvo las
 * series simuladas documentadas en `metrics.js`.
 */
import { agentStatusSummary } from './agents.service.js';
import {
  campaignRanking,
  campaignTotals,
  campaignTotalsByChannel,
  departmentWorkload,
  experimentResults,
  landingTotals,
  leadTotals,
  leadsByOrigin,
  leadsSeries,
  productRanking,
  productTotals,
  revenueSeries,
} from './metrics.js';

const FUNNEL_STEPS = [
  { key: 'visitors', label: 'Visitas en landings' },
  { key: 'leads', label: 'Leads captados' },
  { key: 'qualified', label: 'Leads cualificados' },
  { key: 'proposal', label: 'Propuestas enviadas' },
  { key: 'won', label: 'Cierres' },
];

const buildFunnel = (leadSummary) => {
  const values = {
    visitors: landingTotals().visitors,
    leads: campaignTotals().leads,
    qualified: leadSummary.byStatus.qualified + leadSummary.byStatus.proposal + leadSummary.won,
    proposal: leadSummary.byStatus.proposal + leadSummary.byStatus.won,
    won: leadSummary.won,
  };

  return FUNNEL_STEPS.map((step, index) => {
    const previousKey = FUNNEL_STEPS[index - 1]?.key;
    const previous = previousKey ? values[previousKey] : null;
    return {
      key: step.key,
      label: step.label,
      value: values[step.key],
      stepRate: previous ? Number((values[step.key] / previous).toFixed(4)) : 1,
    };
  });
};

/** Frases derivadas de los propios datos, sin cifras inventadas. */
const buildInsights = (channels, leadSummary, experiments, productSummary) => {
  const insights = [];
  const bestChannel = channels[0];
  const totalRevenue = channels.reduce((total, channel) => total + channel.revenue, 0);

  if (bestChannel) {
    insights.push({
      level: 'success',
      title: `${bestChannel.label} lidera la atribucion`,
      detail: `Aporta ${bestChannel.revenue.toLocaleString('es-ES')} EUR de ${totalRevenue.toLocaleString('es-ES')} EUR simulados, con un ROAS de ${bestChannel.roas}x.`,
    });
  }

  const organic = channels.find((channel) => channel.label === 'organico');
  if (organic) {
    insights.push({
      level: 'info',
      title: 'El canal organico rinde por encima de su coste',
      detail: `Genera ${organic.conversions} conversion/es con solo ${organic.spend.toLocaleString('es-ES')} EUR de gasto simulado.`,
    });
  }

  if (leadSummary.highPriority > 0) {
    insights.push({
      level: 'info',
      title: `${leadSummary.highPriority} leads de prioridad alta`,
      detail: `El pipeline abierto suma ${leadSummary.pipelineValue.toLocaleString('es-ES')} EUR con una puntuacion media de ${leadSummary.averageScore}.`,
    });
  }

  const winner = experiments.find((experiment) => experiment.lift > 0);
  if (winner) {
    insights.push({
      level: 'success',
      title: `La variante ${winner.winner.name} gana en ${winner.slug}`,
      detail: `Mejora la conversion de la alternativa en un ${Math.round(winner.lift * 100)}%.`,
    });
  }

  if (productSummary.averageMargin > 0) {
    insights.push({
      level: 'info',
      title: 'Margen medio del catalogo',
      detail: `El margen medio simulado del catalogo es del ${Math.round(productSummary.averageMargin * 100)}% con una puntuacion de validacion media de ${productSummary.averageScore}.`,
    });
  }

  return insights;
};

export const getAnalytics = ({ range = 14 } = {}) => {
  const campaignSummary = campaignTotals();
  const leadSummary = leadTotals();
  const productSummary = productTotals();
  const channels = campaignTotalsByChannel();
  const experiments = experimentResults();

  return {
    range,
    overview: {
      revenue: campaignSummary.revenue,
      spend: campaignSummary.spend,
      roas: campaignSummary.roas,
      conversions: campaignSummary.conversions,
      cpa: campaignSummary.cpa,
      leads: campaignSummary.leads,
      cpl: campaignSummary.cpl,
      ctr: campaignSummary.ctr,
      budgetPacing: campaignSummary.budgetPacing,
      currency: 'EUR',
    },
    funnel: buildFunnel(leadSummary),
    timeseries: {
      revenue: revenueSeries(range),
      leads: leadsSeries(range),
    },
    channels,
    origins: leadsByOrigin(),
    products: productRanking(6),
    campaigns: campaignRanking(6),
    experiments,
    leads: leadSummary,
    productsSummary: productSummary,
    landing: landingTotals(),
    agents: {
      summary: agentStatusSummary(),
      workload: departmentWorkload(),
    },
    insights: buildInsights(channels, leadSummary, experiments, productSummary),
  };
};
