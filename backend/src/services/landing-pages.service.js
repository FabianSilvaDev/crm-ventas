/**
 * Servicio de landing pages: listado, detalle con variantes y resultado del
 * experimento A/B asociado.
 */
import { notFound } from '../errors.js';
import { campaigns, landingPages, leads } from '../mocks/index.js';
import { matchesSearch } from '../utils/validate.js';
import { agentRef, campaignRef, offerRef, productRef } from './enrich.js';
import { experimentResults, landingTotals } from './metrics.js';

const winnerOf = (page) => {
  if (page.variants.length <= 1) return null;
  return [...page.variants].sort((a, b) => b.conversionRate - a.conversionRate)[0];
};

export const serializeLandingPage = (page, { expanded = false } = {}) => {
  const base = {
    id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status,
    template: page.template,
    sections: page.sections,
    performance: page.performance,
    technical: page.technical,
    variants: page.variants,
    winner: winnerOf(page),
    owner: agentRef(page.ownerAgentId),
    offer: offerRef(page.offerId),
    product: productRef(page.productId),
    campaignCount: page.campaignIds.length,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };

  if (!expanded) return base;

  return {
    ...base,
    campaigns: campaigns
      .filter((campaign) => page.campaignIds.includes(campaign.id))
      .map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        channels: campaign.channels,
        revenue: campaign.metrics.revenue,
        roas: campaign.metrics.roas,
      })),
    experiment: experimentResults().find((experiment) => experiment.landingPageId === page.id) ?? null,
    leads: leads
      .filter((lead) => campaigns.find((campaign) => campaign.id === lead.campaignId)?.landingPageId === page.id)
      .reduce(
        (accumulator, lead) => {
          accumulator.total += 1;
          if (lead.status === 'won') accumulator.won += 1;
          accumulator.value += lead.value;
          return accumulator;
        },
        { total: 0, won: 0, value: 0 },
      ),
  };
};

export const listLandingPages = ({ status, template, search, sort = 'visitors' } = {}) => {
  const items = landingPages.filter(
    (page) =>
      (status ? page.status === status : true) &&
      (template ? page.template === template : true) &&
      matchesSearch(page, search, ['slug', 'title', 'template']),
  );

  const sorters = {
    visitors: (a, b) => b.performance.visitors - a.performance.visitors,
    conversionRate: (a, b) => b.performance.conversionRate - a.performance.conversionRate,
    seo: (a, b) => b.technical.seoScore - a.technical.seoScore,
    recent: (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    title: (a, b) => a.title.localeCompare(b.title, 'es'),
  };

  return [...items].sort(sorters[sort] ?? sorters.visitors).map((page) => serializeLandingPage(page));
};

export const getLandingPage = (landingPageId) => {
  const page = landingPages.find((item) => item.id === landingPageId);
  if (!page) throw notFound(`No existe la landing "${landingPageId}".`);
  return serializeLandingPage(page, { expanded: true });
};

export const getLandingSummary = () => ({
  totals: landingTotals(),
  experiments: experimentResults(),
  technical: {
    averageLcpMs: Math.round(
      landingPages.filter((page) => page.technical.lcpMs > 0).reduce((total, page) => total + page.technical.lcpMs, 0) /
        Math.max(1, landingPages.filter((page) => page.technical.lcpMs > 0).length),
    ),
    averageSeoScore: Math.round(
      landingPages.reduce((total, page) => total + page.technical.seoScore, 0) / landingPages.length,
    ),
    pagesNeedingWork: landingPages
      .filter((page) => page.technical.seoScore < 85 || (page.technical.lcpMs > 1800 && page.technical.lcpMs > 0))
      .map((page) => ({ id: page.id, slug: page.slug, seoScore: page.technical.seoScore, lcpMs: page.technical.lcpMs })),
  },
  relatedCampaigns: campaigns.map(campaignRef),
});
