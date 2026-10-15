/**
 * Servicio de productos y ofertas.
 * Cada producto se devuelve con la investigacion que lo respalda, la oferta derivada
 * y las campanas/landings que lo explotan comercialmente.
 */
import { notFound } from '../errors.js';
import { campaigns, landingPages, leads, offers, products, researchReports } from '../mocks/index.js';
import { offerRef, productRef } from './enrich.js';
import { matchesSearch } from '../utils/validate.js';

const campaignsOfProduct = (productId) => campaigns.filter((campaign) => campaign.productId === productId);
const leadsOfProduct = (productId) =>
  leads.filter((lead) => offers.find((offer) => offer.id === lead.offerId)?.productId === productId);

export const serializeProduct = (product, { expanded = false } = {}) => {
  const productCampaigns = campaignsOfProduct(product.id);
  const productLeads = leadsOfProduct(product.id);
  const revenue = productCampaigns.reduce((total, campaign) => total + campaign.metrics.revenue, 0) + product.kpis.revenue;

  const base = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    status: product.status,
    supplier: product.supplier,
    pricing: product.pricing,
    validation: product.validation,
    kpis: { ...product.kpis, campaignsRevenue: revenue },
    tags: product.tags,
    offer: offerRef(product.offerId),
    researchId: product.researchId,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };

  if (!expanded) return base;

  return {
    ...base,
    research: researchReports.find((report) => report.id === product.researchId) ?? null,
    offer: offers.find((offer) => offer.id === product.offerId) ?? null,
    campaigns: productCampaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      spend: campaign.metrics.spend,
      revenue: campaign.metrics.revenue,
      roas: campaign.metrics.roas,
      conversions: campaign.metrics.conversions,
    })),
    landingPages: landingPages
      .filter((page) => page.productId === product.id)
      .map((page) => ({
        id: page.id,
        slug: page.slug,
        status: page.status,
        conversionRate: page.performance.conversionRate,
        visitors: page.performance.visitors,
      })),
    leads: {
      total: productLeads.length,
      won: productLeads.filter((lead) => lead.status === 'won').length,
      pipelineValue: productLeads
        .filter((lead) => ['new', 'contacted', 'qualified', 'proposal'].includes(lead.status))
        .reduce((total, lead) => total + lead.value, 0),
    },
    timeline: [
      { at: product.createdAt, label: 'Producto registrado para investigacion' },
      product.validation.validatedAt
        ? { at: product.validation.validatedAt, label: 'Validacion completada' }
        : { at: product.updatedAt, label: 'Validacion en curso' },
      ...productCampaigns.map((campaign) => ({
        at: campaign.startDate,
        label: `Campana "${campaign.name}" en ${campaign.channels.join(', ')}`,
      })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
  };
};

export const listProducts = ({ status, category, search, sort = 'revenue' } = {}) => {
  const items = products.filter(
    (product) =>
      (status ? product.status === status : true) &&
      (category ? product.category === category : true) &&
      matchesSearch(product, search, ['name', 'sku', 'category', 'supplier', 'tags']),
  );

  const sorters = {
    revenue: (a, b) => b.kpis.revenue - a.kpis.revenue,
    score: (a, b) => b.validation.score - a.validation.score,
    margin: (a, b) => b.validation.margin - a.validation.margin,
    name: (a, b) => a.name.localeCompare(b.name, 'es'),
    updated: (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  };

  return [...items].sort(sorters[sort] ?? sorters.revenue).map((product) => serializeProduct(product));
};

export const getProduct = (productId) => {
  const product = products.find((item) => item.id === productId);
  if (!product) throw notFound(`No existe el producto "${productId}".`);
  return serializeProduct(product, { expanded: true });
};

export const listCategories = () => [...new Set(products.map((product) => product.category))].sort();

export const serializeOffer = (offer, { expanded = false } = {}) => {
  const offerCampaigns = campaigns.filter((campaign) => campaign.offerId === offer.id);
  const offerLeads = leads.filter((lead) => lead.offerId === offer.id);
  const base = {
    id: offer.id,
    name: offer.name,
    status: offer.status,
    positioning: offer.positioning,
    channel: offer.channel,
    price: offer.price,
    currency: offer.currency,
    guarantee: offer.guarantee,
    tiers: offer.tiers,
    conversionRate: offer.conversionRate,
    product: productRef(offer.productId),
    createdAt: offer.createdAt,
  };

  if (!expanded) return base;

  return {
    ...base,
    campaigns: offerCampaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      revenue: campaign.metrics.revenue,
      roas: campaign.metrics.roas,
    })),
    landingPages: landingPages
      .filter((page) => page.offerId === offer.id)
      .map((page) => ({ id: page.id, slug: page.slug, status: page.status, conversionRate: page.performance.conversionRate })),
    leads: {
      total: offerLeads.length,
      won: offerLeads.filter((lead) => lead.status === 'won').length,
      value: offerLeads.reduce((total, lead) => total + lead.value, 0),
    },
    revenue: offerCampaigns.reduce((total, campaign) => total + campaign.metrics.revenue, 0),
  };
};

export const listOffers = ({ status, productId, search } = {}) =>
  offers
    .filter(
      (offer) =>
        (status ? offer.status === status : true) &&
        (productId ? offer.productId === productId : true) &&
        matchesSearch(offer, search, ['name', 'positioning', 'channel']),
    )
    .map((offer) => serializeOffer(offer));

export const getOffer = (offerId) => {
  const offer = offers.find((item) => item.id === offerId);
  if (!offer) throw notFound(`No existe la oferta "${offerId}".`);
  return serializeOffer(offer, { expanded: true });
};
