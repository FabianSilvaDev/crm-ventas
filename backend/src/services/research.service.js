/**
 * Servicio de investigacion de mercado: informes de mercado, tendencias,
 * competencia y validacion de producto.
 */
import { notFound } from '../errors.js';
import { researchReports } from '../mocks/index.js';
import { matchesSearch } from '../utils/validate.js';
import { agentRef, productRef } from './enrich.js';

export const serializeResearch = (report, { expanded = false } = {}) => {
  const base = {
    id: report.id,
    title: report.title,
    type: report.type,
    summary: report.summary,
    status: report.status,
    publishedAt: report.publishedAt,
    metrics: report.metrics,
    author: agentRef(report.authorAgentId),
    product: productRef(report.productId),
    findingCount: report.findings.length,
    sourceCount: report.sources.length,
  };

  if (!expanded) return base;

  return {
    ...base,
    findings: report.findings,
    sources: report.sources,
    competitors: report.competitors ?? [],
    series: report.series ?? [],
  };
};

export const listResearch = ({ type, status, productId, search, sort = 'recent' } = {}) => {
  const items = researchReports.filter(
    (report) =>
      (type ? report.type === type : true) &&
      (status ? report.status === status : true) &&
      (productId ? report.productId === productId : true) &&
      matchesSearch(report, search, ['title', 'summary']),
  );

  const sorters = {
    recent: (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    title: (a, b) => a.title.localeCompare(b.title, 'es'),
    type: (a, b) => a.type.localeCompare(b.type, 'es'),
  };

  return [...items].sort(sorters[sort] ?? sorters.recent).map((report) => serializeResearch(report));
};

export const getResearch = (researchId) => {
  const report = researchReports.find((item) => item.id === researchId);
  if (!report) throw notFound(`No existe el informe "${researchId}".`);
  return serializeResearch(report, { expanded: true });
};

export const getResearchSummary = () => ({
  totals: {
    reports: researchReports.length,
    published: researchReports.filter((report) => report.status === 'published').length,
    findings: researchReports.reduce((total, report) => total + report.findings.length, 0),
    sources: researchReports.reduce((total, report) => total + report.sources.length, 0),
    competitors: researchReports.reduce((total, report) => total + (report.competitors?.length ?? 0), 0),
  },
  byType: ['market', 'trends', 'competitors', 'validation'].map((type) => ({
    type,
    count: researchReports.filter((report) => report.type === type).length,
  })),
  /** Productos cuya validacion esta pendiente: pendientes de decision del operador. */
  pendingValidation: researchReports
    .filter((report) => report.status === 'draft' || report.type === 'validation')
    .map((report) => serializeResearch(report)),
});
