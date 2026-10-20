/**
 * Servicio de investigacion de mercado: informes de mercado, tendencias,
 * competencia y validacion de producto.
 *
 * Convive con dos origenes, y la diferencia es importante:
 *  - `demo`: los informes escritos a mano en `mocks/research.js` (el estado inicial).
 *  - `run`: los que genera una ejecucion real consultando las fuentes (`conductResearch`).
 * El campo `origin` viaja siempre, para que nunca se confunda un dato de ejemplo con uno
 * recogido de verdad.
 */
import { notFound } from '../errors.js';
import { researchReports } from '../mocks/index.js';
import { nextResearchId, store } from '../store.js';
import { collectSignals } from '../sources/index.js';
import { metricDefinition } from '../sources/signal.js';
import { matchesSearch } from '../utils/validate.js';
import { nowIso } from '../utils/time.js';
import { agentRef, productRef } from './enrich.js';

/** Todos los informes: primero los generados (mas recientes) y despues los de la demo. */
const allReports = () => [...store.researchReports, ...researchReports];

/** Etiqueta legible de una señal: "Demanda 46 (Datos de demostracion)". */
const metricLabel = (signal) => ({
  label: `${signal.metricLabel} · ${signal.source.name}`,
  value: `${signal.value} ${signal.unit}`.trim(),
});

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
    /** `demo` (escrito a mano) o `run` (generado consultando las fuentes). */
    origin: report.origin ?? 'demo',
    /** Lo que no se pudo conseguir, dicho sin rodeos. */
    limitations: report.limitations ?? [],
    opportunityId: report.opportunityId ?? null,
    sourceMode: report.sourceMode ?? null,
  };

  if (!expanded) return base;

  return {
    ...base,
    findings: report.findings,
    sources: report.sources,
    competitors: report.competitors ?? [],
    series: report.series ?? [],
    /** Procedencia completa de cada cifra (solo en los informes generados). */
    signals: report.signals ?? [],
    collectedAt: report.collectedAt ?? report.publishedAt,
  };
};

export const listResearch = ({ type, status, productId, search, sort = 'recent' } = {}) => {
  const items = allReports().filter(
    (report) =>
      (type ? report.type === type : true) &&
      (status ? report.status === status : true) &&
      (productId ? report.productId === productId : true) &&
      matchesSearch(report, search, ['title', 'summary', 'keyword']),
  );

  const sorters = {
    recent: (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    title: (a, b) => a.title.localeCompare(b.title, 'es'),
    type: (a, b) => a.type.localeCompare(b.type, 'es'),
  };

  return [...items].sort(sorters[sort] ?? sorters.recent).map((report) => serializeResearch(report));
};

export const getResearch = (researchId) => {
  const report = allReports().find((item) => item.id === researchId);
  if (!report) throw notFound(`No existe el informe "${researchId}".`);
  return serializeResearch(report, { expanded: true });
};

/** Hallazgos derivados de las señales reales. Nada que no venga de una fuente. */
const findingsFrom = (signals, notes) => {
  const findings = [];
  const byMetric = (metric) => signals.find((signal) => signal.metric === metric);

  const demand = byMetric('demand');
  if (demand) findings.push(`Demanda relativa de ${demand.value} sobre 100 (${demand.source.name}).`);

  const momentum = byMetric('momentum');
  if (momentum) findings.push(`Tendencia del ${momentum.value}% en el ultimo tramo (${momentum.source.name}).`);

  const competition = byMetric('competition');
  if (competition) {
    const level = competition.value > 200 ? 'alta' : competition.value > 50 ? 'media' : 'contenida';
    findings.push(`${competition.value} ofertas comparables: competencia ${level} (${competition.source.name}).`);
  }

  const cost = byMetric('cost');
  if (cost) findings.push(`Coste observado de ${cost.value} ${cost.unit} (${cost.source.name}).`);

  const price = byMetric('price');
  if (price) findings.push(`Precio de mercado de ${price.value} ${price.unit} (${price.source.name}).`);

  // Los temas que resuelve Trends son un hallazgo por si mismos: dicen si el termino es
  // un tema real o solo una descripcion.
  for (const note of notes ?? []) {
    if (note.topics?.length) findings.push(note.message);
  }

  return findings;
};

/**
 * Realiza la investigacion de un termino consultando las fuentes y registra un informe.
 *
 * Es lo que hace que la etapa Research no sea decorativa: si hay fuentes, el informe
 * lleva sus cifras con procedencia; si no las hay, lo dice y el informe queda marcado
 * con sus limitaciones. Nunca rellena el hueco con numeros inventados.
 *
 * @returns {Promise<object>} Informe guardado en `store.researchReports`.
 */
export const conductResearch = async ({ opportunityId = null, keyword, mode = 'auto', geo, timeframe } = {}) => {
  const collection = await collectSignals({ keywords: [keyword], mode, geo, timeframe });
  const signals = collection.signals;
  const liveSignals = signals.filter((signal) => signal.source.mode === 'live');

  const limitations = [];
  for (const source of collection.sources) {
    if (source.mode === 'unavailable' || source.mode === 'error') {
      limitations.push(`${source.name}: no disponible (${source.reason ?? 'sin respuesta'}).`);
    }
  }
  if (signals.length > 0 && liveSignals.length === 0) {
    limitations.push('Ninguna fuente real aporto datos: las cifras de este informe son de demostracion.');
  }
  if (!signals.some((signal) => signal.metric === 'price') && !signals.some((signal) => signal.metric === 'cost')) {
    limitations.push('Sin coste ni precio de mercado, el margen no se puede contrastar.');
  }
  if (signals.length === 0) {
    limitations.push('Ninguna fuente devolvio datos: no hay informe de mercado que contrastar.');
  }

  const sourceNames = [...new Set(signals.map((signal) => signal.source.name))];

  // Las metricas que ninguna fuente ha aportado se muestran a **0**, no se omiten ni se
  // estiman: un cero declarado es un dato; un numero inventado es una mentira.
  const metrics = signals.map(metricLabel);
  for (const metric of ['demand', 'momentum', 'cost', 'price', 'competition']) {
    if (signals.some((signal) => signal.metric === metric)) continue;
    metrics.push({ label: `${metricDefinition(metric).label} · sin datos`, value: '0' });
  }

  const summary =
    signals.length === 0
      ? `No se pudo completar la investigacion de «${keyword}»: ninguna fuente aporto datos. Las metricas quedan a 0.`
      : `Investigacion de «${keyword}» con ${signals.length} dato(s) de ${sourceNames.length} fuente(s) (${sourceNames.join(', ')}). ` +
        (limitations.length > 0 ? `Limitaciones: ${limitations.join(' ')}` : 'Sin limitaciones registradas.');

  const report = {
    id: nextResearchId(),
    origin: 'run',
    opportunityId,
    keyword,
    productId: null,
    type: 'market',
    title: `Investigacion de mercado: ${keyword}`,
    summary: summary.trim(),
    status: 'published',
    authorAgentId: 'agt-002',
    publishedAt: collection.collectedAt ?? nowIso(),
    metrics,
    findings: findingsFrom(signals, collection.notes),
    sources: collection.sources.map((source) => ({ title: `${source.name} · ${source.mode}`, type: source.mode })),
    limitations,
    signals,
    collectedAt: collection.collectedAt ?? nowIso(),
    sourceMode: collection.mode,
    geo: geo ?? null,
    timeframe: timeframe ?? null,
  };

  store.researchReports.unshift(report);
  if (store.researchReports.length > 60) store.researchReports.length = 60;

  return report;
};

export const getResearchSummary = () => {
  const reports = allReports();

  return {
    totals: {
      reports: reports.length,
      /** Cuantos de ellos los ha generado una ejecucion consultando las fuentes. */
      generated: store.researchReports.length,
      published: reports.filter((report) => report.status === 'published').length,
      findings: reports.reduce((total, report) => total + report.findings.length, 0),
      sources: reports.reduce((total, report) => total + report.sources.length, 0),
      competitors: reports.reduce((total, report) => total + (report.competitors?.length ?? 0), 0),
    },
    byType: ['market', 'trends', 'competitors', 'validation'].map((type) => ({
      type,
      count: reports.filter((report) => report.type === type).length,
    })),
    /** Productos cuya validacion esta pendiente: pendientes de decision del operador. */
    pendingValidation: reports
      .filter((report) => report.status === 'draft' || report.type === 'validation')
      .map((report) => serializeResearch(report)),
  };
};
