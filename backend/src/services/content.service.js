/**
 * Servicio de contenido y creatividades (Marketing Studio y Creative Studio).
 */
import { notFound } from '../errors.js';
import { contentPieces, creatives } from '../mocks/index.js';
import { matchesSearch } from '../utils/validate.js';
import { agentRef, campaignRef, offerRef, productRef } from './enrich.js';

const ctr = (performance) =>
  performance.impressions === 0 ? 0 : Number((performance.clicks / performance.impressions).toFixed(4));

export const serializeContent = (piece) => ({
  id: piece.id,
  title: piece.title,
  type: piece.type,
  channel: piece.channel,
  status: piece.status,
  keywords: piece.keywords,
  wordCount: piece.wordCount,
  publishedAt: piece.publishedAt,
  performance: { ...piece.performance, ctr: ctr(piece.performance) },
  author: agentRef(piece.authorAgentId),
  offer: offerRef(piece.offerId),
  product: productRef(piece.productId),
});

export const serializeCreative = (creative) => ({
  id: creative.id,
  name: creative.name,
  format: creative.format,
  dimensions: creative.dimensions,
  status: creative.status,
  palette: creative.palette,
  variants: creative.variants,
  performance: { ...creative.performance, ctr: ctr(creative.performance) },
  author: agentRef(creative.authorAgentId),
  reviewer: agentRef(creative.reviewedByAgentId),
  campaign: campaignRef(creative.campaignId),
  offer: offerRef(creative.offerId),
  createdAt: creative.createdAt,
});

export const listContent = ({ type, status, channel, search, sort = 'recent' } = {}) => {
  const items = contentPieces.filter(
    (piece) =>
      (type ? piece.type === type : true) &&
      (status ? piece.status === status : true) &&
      (channel ? piece.channel === channel : true) &&
      matchesSearch(piece, search, ['title', 'keywords']),
  );

  const sorters = {
    recent: (a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime(),
    impressions: (a, b) => b.performance.impressions - a.performance.impressions,
    conversions: (a, b) => b.performance.conversions - a.performance.conversions,
    title: (a, b) => a.title.localeCompare(b.title, 'es'),
  };

  return [...items].sort(sorters[sort] ?? sorters.recent).map(serializeContent);
};

export const getContent = (contentId) => {
  const piece = contentPieces.find((item) => item.id === contentId);
  if (!piece) throw notFound(`No existe el contenido "${contentId}".`);
  return serializeContent(piece);
};

export const listCreatives = ({ format, status, campaignId, search, sort = 'impressions' } = {}) => {
  const items = creatives.filter(
    (creative) =>
      (format ? creative.format === format : true) &&
      (status ? creative.status === status : true) &&
      (campaignId ? creative.campaignId === campaignId : true) &&
      matchesSearch(creative, search, ['name', 'format', 'palette']),
  );

  const sorters = {
    impressions: (a, b) => b.performance.impressions - a.performance.impressions,
    conversions: (a, b) => b.performance.conversions - a.performance.conversions,
    recent: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    name: (a, b) => a.name.localeCompare(b.name, 'es'),
  };

  return [...items].sort(sorters[sort] ?? sorters.impressions).map(serializeCreative);
};

export const getCreative = (creativeId) => {
  const creative = creatives.find((item) => item.id === creativeId);
  if (!creative) throw notFound(`No existe la creatividad "${creativeId}".`);
  return serializeCreative(creative);
};

export const getContentSummary = () => {
  const published = contentPieces.filter((piece) => piece.status === 'published');
  const totalImpressions = contentPieces.reduce((total, piece) => total + piece.performance.impressions, 0);
  const totalConversions = contentPieces.reduce((total, piece) => total + piece.performance.conversions, 0);

  return {
    totals: {
      pieces: contentPieces.length,
      published: published.length,
      inProgress: contentPieces.filter((piece) => ['idea', 'draft', 'review'].includes(piece.status)).length,
      creatives: creatives.length,
      liveCreatives: creatives.filter((creative) => creative.status === 'live').length,
      impressions: totalImpressions,
      conversions: totalConversions,
      words: contentPieces.reduce((total, piece) => total + piece.wordCount, 0),
    },
    byType: [...new Set(contentPieces.map((piece) => piece.type))].map((type) => ({
      type,
      count: contentPieces.filter((piece) => piece.type === type).length,
      conversions: contentPieces
        .filter((piece) => piece.type === type)
        .reduce((total, piece) => total + piece.performance.conversions, 0),
    })),
    topContent: [...published]
      .sort((a, b) => b.performance.conversions - a.performance.conversions)
      .slice(0, 5)
      .map(serializeContent),
    topCreatives: [...creatives]
      .sort((a, b) => b.performance.conversions - a.performance.conversions)
      .slice(0, 5)
      .map(serializeCreative),
  };
};

export const listContentTypes = () => [...new Set(contentPieces.map((piece) => piece.type))].sort();
export const listCreativeFormats = () => [...new Set(creatives.map((creative) => creative.format))].sort();
