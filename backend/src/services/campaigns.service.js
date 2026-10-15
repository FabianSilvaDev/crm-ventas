/**
 * Servicio de campanas: listado con filtros, detalle y resumen publicitario.
 */
import { notFound } from '../errors.js';
import { campaignById, campaigns, creatives, landingPages, leads } from '../mocks/index.js';
import { matchesSearch } from '../utils/validate.js';
import { agentRefs, landingPageRef, offerRef, productRef } from './enrich.js';
import { campaignRanking, campaignTotals, campaignTotalsByChannel } from './metrics.js';

export const serializeCampaign = (campaign, { expanded = false } = {}) => {
  const campaignLeads = leads.filter((lead) => lead.campaignId === campaign.id);
  const base = {
    id: campaign.id,
    name: campaign.name,
    objective: campaign.objective,
    status: campaign.status,
    channels: campaign.channels,
    primaryChannel: campaign.channels[0] ?? null,
    budget: campaign.budget,
    metrics: campaign.metrics,
    pacing: campaign.budget.total === 0 ? 0 : Number((campaign.metrics.spend / campaign.budget.total).toFixed(4)),
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    offer: offerRef(campaign.offerId),
    product: productRef(campaign.productId),
    landingPage: landingPageRef(campaign.landingPageId),
    agents: agentRefs(campaign.agentIds),
    leadCount: campaignLeads.length,
  };

  if (!expanded) return base;

  return {
    ...base,
    creatives: creatives
      .filter((creative) => creative.campaignId === campaign.id)
      .map((creative) => ({
        id: creative.id,
        name: creative.name,
        format: creative.format,
        dimensions: creative.dimensions,
        status: creative.status,
        palette: creative.palette,
        performance: creative.performance,
      })),
    audienceIds: campaign.audienceIds,
    landingPageDetail: landingPages.find((page) => page.id === campaign.landingPageId) ?? null,
    leads: {
      total: campaignLeads.length,
      won: campaignLeads.filter((lead) => lead.status === 'won').length,
      qualified: campaignLeads.filter((lead) => lead.status === 'qualified').length,
      averageScore:
        campaignLeads.length === 0
          ? 0
          : Number((campaignLeads.reduce((total, lead) => total + lead.score, 0) / campaignLeads.length).toFixed(1)),
      sample: campaignLeads.slice(0, 5).map((lead) => ({
        id: lead.id,
        contact: lead.contact.name,
        company: lead.company.name,
        status: lead.status,
        score: lead.score,
        value: lead.value,
      })),
    },
  };
};

export const listCampaigns = ({ status, channel, search, sort = 'revenue' } = {}) => {
  const items = campaigns.filter(
    (campaign) =>
      (status ? campaign.status === status : true) &&
      (channel ? campaign.channels.includes(channel) : true) &&
      matchesSearch(campaign, search, ['name', 'objective']),
  );

  const sorters = {
    revenue: (a, b) => b.metrics.revenue - a.metrics.revenue,
    roas: (a, b) => b.metrics.roas - a.metrics.roas,
    spend: (a, b) => b.metrics.spend - a.metrics.spend,
    conversions: (a, b) => b.metrics.conversions - a.metrics.conversions,
    startDate: (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    name: (a, b) => a.name.localeCompare(b.name, 'es'),
  };

  return [...items].sort(sorters[sort] ?? sorters.revenue).map((campaign) => serializeCampaign(campaign));
};

export const getCampaign = (campaignId) => {
  const campaign = campaignById.get(campaignId);
  if (!campaign) throw notFound(`No existe la campana "${campaignId}".`);
  return serializeCampaign(campaign, { expanded: true });
};

export const getCampaignSummary = () => ({
  totals: campaignTotals(),
  byChannel: campaignTotalsByChannel(),
  ranking: campaignRanking(6),
  statusBreakdown: campaigns.reduce((accumulator, campaign) => {
    accumulator[campaign.status] = (accumulator[campaign.status] ?? 0) + 1;
    return accumulator;
  }, {}),
});

export const listChannels = () => [...new Set(campaigns.flatMap((campaign) => campaign.channels))].sort();
