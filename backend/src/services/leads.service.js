/**
 * Servicio de leads y ventas: listado con filtros, detalle con su traza y resumen
 * del embudo comercial.
 */
import { notFound } from '../errors.js';
import { LEAD_ORIGINS, LEAD_STATUSES, leads, offers, products } from '../mocks/index.js';
import { DAY_MS, DEMO_REFERENCE_MS } from '../utils/time.js';
import { matchesSearch } from '../utils/validate.js';
import { agentRef, campaignRef, offerRef, productRef } from './enrich.js';
import { leadTotals } from './metrics.js';

const productOfOffer = (offerId) => {
  const offer = offers.find((item) => item.id === offerId);
  return productRef(offer?.productId ?? null);
};

export const serializeLead = (lead, { expanded = false } = {}) => {
  // `productId` llega como null en el mock: el producto real se resuelve via la oferta.
  const { productId: _unresolvedProductId, ...rest } = lead;
  const base = {
    ...rest,
    product: productOfOffer(lead.offerId),
    offer: offerRef(lead.offerId),
    campaign: campaignRef(lead.campaignId),
    ownerAgent: agentRef(lead.ownerAgentId),
    daysSinceCreation: Math.max(0, Math.round((DEMO_REFERENCE_MS - new Date(lead.createdAt).getTime()) / DAY_MS)),
  };

  if (!expanded) return base;

  return {
    ...base,
    productDetail: products.find((product) => product.id === base.product?.id) ?? null,
    timeline: lead.timeline.map((entry) => ({ ...entry, agent: agentRef(entry.agentId) })),
  };
};

export const listLeads = ({
  status,
  origin,
  campaignId,
  offerId,
  priority,
  minScore,
  search,
  sort = 'score',
} = {}) => {
  const items = leads.filter(
    (lead) =>
      (status ? lead.status === status : true) &&
      (origin ? lead.origin === origin : true) &&
      (campaignId ? lead.campaignId === campaignId : true) &&
      (offerId ? lead.offerId === offerId : true) &&
      (priority ? lead.priority === priority : true) &&
      (minScore === undefined ? true : lead.score >= minScore) &&
      matchesSearch(lead, search, ['contact.name', 'company.name', 'company.industry', 'company.city']),
  );

  const sorters = {
    score: (a, b) => b.score - a.score,
    value: (a, b) => b.value - a.value,
    recent: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    company: (a, b) => a.company.name.localeCompare(b.company.name, 'es'),
  };

  return [...items].sort(sorters[sort] ?? sorters.score).map((lead) => serializeLead(lead));
};

export const getLead = (leadId) => {
  const lead = leads.find((item) => item.id === leadId);
  if (!lead) throw notFound(`No existe el lead "${leadId}".`);
  return serializeLead(lead, { expanded: true });
};

export const getLeadsSummary = () => {
  const totals = leadTotals();
  return {
    totals,
    statuses: LEAD_STATUSES,
    origins: LEAD_ORIGINS,
    byOrigin: LEAD_ORIGINS.map((origin) => ({
      origin,
      count: leads.filter((lead) => lead.origin === origin).length,
      won: leads.filter((lead) => lead.origin === origin && lead.status === 'won').length,
      value: leads.filter((lead) => lead.origin === origin).reduce((total, lead) => total + lead.value, 0),
    })),
    byPriority: ['alta', 'media', 'baja'].map((priority) => ({
      priority,
      count: leads.filter((lead) => lead.priority === priority).length,
    })),
    topLeads: leads
      .filter((lead) => ['new', 'contacted', 'qualified', 'proposal'].includes(lead.status))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((lead) => serializeLead(lead)),
  };
};
