/**
 * Referencias enriquecidas y compartidas entre servicios.
 *
 * Evita que cada servicio repita los mismos cruces de datos (producto -> oferta ->
 * landing -> campana) y garantiza que las vistas muestren la misma informacion.
 * Los agentes se leen del `store`, de modo que una referencia siempre refleja el
 * estado actual del agente, no el inicial de los mocks.
 */
import { departmentById } from '../mocks/departments.js';
import { agentById } from '../mocks/agents.js';
import { offerById, productById } from '../mocks/products.js';
import { campaignById } from '../mocks/campaigns.js';
import { landingPageById } from '../mocks/landing-pages.js';
import { findAgent } from '../store.js';

export const departmentRef = (departmentId) => {
  const department = departmentById.get(departmentId);
  if (!department) return null;
  return {
    id: department.id,
    name: department.name,
    shortName: department.shortName,
    accent: department.accent,
  };
};

export const agentRef = (agentId) => {
  const agent = findAgent(agentId) ?? agentById.get(agentId);
  if (!agent) return null;
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    specialty: agent.specialty,
    status: agent.status,
    avatar: agent.avatar,
    department: departmentRef(agent.departmentId),
  };
};

export const agentRefs = (agentIds = []) => agentIds.map(agentRef).filter(Boolean);

export const productRef = (productId) => {
  const product = productId ? productById.get(productId) : null;
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    status: product.status,
    price: product.pricing.price,
    currency: product.pricing.currency,
  };
};

export const offerRef = (offerId) => {
  const offer = offerId ? offerById.get(offerId) : null;
  if (!offer) return null;
  return {
    id: offer.id,
    name: offer.name,
    status: offer.status,
    price: offer.price,
    currency: offer.currency,
    productId: offer.productId,
  };
};

export const campaignRef = (campaignId) => {
  const campaign = campaignId ? campaignById.get(campaignId) : null;
  if (!campaign) return null;
  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    channels: campaign.channels,
  };
};

export const landingPageRef = (landingPageId) => {
  const page = landingPageId ? landingPageById.get(landingPageId) : null;
  if (!page) return null;
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status,
    conversionRate: page.performance.conversionRate,
  };
};

/** Referencia generica usada por la actividad y los artefactos de etapa. */
export const referenceByType = (type, id, label) => {
  switch (type) {
    case 'agent':
      return { type, id, label: label ?? agentRef(id)?.name };
    case 'product':
      return { type, id, label: label ?? productRef(id)?.name };
    case 'offer':
      return { type, id, label: label ?? offerRef(id)?.name };
    case 'campaign':
      return { type, id, label: label ?? campaignRef(id)?.name };
    case 'landing-page':
      return { type, id, label: label ?? landingPageRef(id)?.slug };
    default:
      return { type, id, label };
  }
};
