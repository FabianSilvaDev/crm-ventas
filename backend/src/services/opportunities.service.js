/**
 * Oportunidades: la cola donde Yanca deja lo que encuentra.
 *
 * Una oportunidad es un registro con historia, no un numero suelto:
 *  - guarda **su ultimo estudio** (puntuacion, cobertura, componentes con su fuente,
 *    lo que falta y por que),
 *  - guarda el **historial de revisiones**, para ver como cambio la valoracion entre
 *    estudios,
 *  - y guarda **la decision del operador** (aprobada o descartada) con su motivo.
 *
 * Esa ultima parte tiene una regla que se cumple siempre: **un estudio nuevo no
 * reescribe una decision humana**. Si tu descartaste una oportunidad, volver a
 * estudiarla actualiza los datos pero no la resucita en silencio.
 */
import { badRequest, conflict, notFound } from '../errors.js';
import { nextOpportunityId, pushActivity, store } from '../store.js';
import { nowIso } from '../utils/time.js';
import { catalogLinkForProduct, scan } from './intake.service.js';
import { createRun, serializeRun } from './workflow-simulator.js';
import { getWorkflowOrThrow } from './workflows.service.js';

export const OPPORTUNITY_STATUSES = ['candidate', 'approved', 'discarded'];

/** Estados en los que el producto ya lo ha decidido el operador. */
const DECIDED_PRODUCT_STATUSES = ['confirmed', 'category'];

const hasDecidedProduct = (hypothesis) => DECIDED_PRODUCT_STATUSES.includes(hypothesis?.status);

/**
 * Situacion del producto de una oportunidad, en palabras.
 * La interfaz la usa para preguntar antes de aprobar: "¿es este el producto que esperas?".
 */
export const describeProductSituation = (opportunity) => {
  const hypothesis = opportunity.productHypothesis ?? { status: 'none' };

  if (hypothesis.status === 'confirmed') {
    return { level: 'clear', text: `Producto confirmado: ${hypothesis.name ?? hypothesis.productId}.` };
  }
  if (hypothesis.status === 'category') {
    return { level: 'category', text: 'Aprobada como categoria: no hay un producto concreto.' };
  }
  if (hypothesis.confidence === 'alta') {
    return { level: 'proposed', text: `Producto identificado: ${hypothesis.name} (${hypothesis.basis}).` };
  }
  if (hypothesis.status === 'proposed') {
    return {
      level: 'ambiguous',
      text: `Solo se ha reconocido una categoria. Propuesta de ejemplo: ${hypothesis.name}. Hay que confirmar cual es el producto.`,
    };
  }
  return { level: 'missing', text: 'No se ha identificado ningun producto: hay que indicarlo antes de aprobar.' };
};

/** Flujo que se lanza por defecto al aprobar una oportunidad. */
export const DEFAULT_WORKFLOW_ID = 'wf-full-cycle';

/** Oportunidades con las que arranca la demostracion, coherentes con el flujo. */
const DEMO_KEYWORDS = ['perifericos para estudio en casa', 'teclado mecanico compacto', 'lampara de escritorio'];

/** Identificador legible a partir del termino: `teclado-mecanico-compacto`. */
export const slugify = (keyword) =>
  keyword
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** Resumen del estudio que se guarda como fotografia mas reciente. */
const snapshotOf = (candidate, { geo, timeframe, mode, collectedAt }) => ({
  score: candidate.score,
  coverage: candidate.coverage,
  confidence: candidate.confidence,
  verdict: candidate.verdict,
  economics: candidate.economics,
  components: candidate.components,
  missing: candidate.missing,
  checks: candidate.checks,
  collectedAt: collectedAt ?? nowIso(),
  sourceMode: mode ?? 'auto',
  geo: geo ?? null,
  timeframe: timeframe ?? null,
});

const serialize = (opportunity) => ({
  ...opportunity,
  /** Cuantos estudios lleva: si sube, la valoracion se ha revisado. */
  studyCount: opportunity.revisions.length,
});

/**
 * Registra (o actualiza) una candidata en la cola.
 * Devuelve el registro con su historial.
 */
export const registerCandidate = (candidate, context = {}) => {
  const slug = slugify(candidate.keyword);
  const snapshot = snapshotOf(candidate, context);
  const existing = store.opportunities.find((opportunity) => opportunity.slug === slug);

  if (existing) {
    const revision = existing.revision + 1;
    existing.revision = revision;
    existing.lastScanAt = nowIso();
    existing.latest = snapshot;
    // El enlace con el catalogo puede cambiar entre estudios, asi que se refresca.
    existing.catalogLink = candidate.catalogLink ?? null;
    // La propuesta del sistema se refresca en cada estudio, SALVO que el operador ya
    // haya decidido el producto: su decision no se pisa.
    existing.productHypothesis = hasDecidedProduct(existing.productHypothesis)
      ? existing.productHypothesis
      : (candidate.productHypothesis ?? existing.productHypothesis);
    existing.revisions.push({
      revision,
      at: nowIso(),
      score: snapshot.score,
      coverage: snapshot.coverage,
      verdict: snapshot.verdict,
      margin: snapshot.economics?.margin ?? null,
    });
    if (existing.revisions.length > 20) existing.revisions.shift();

    return serialize(existing);
  }

  const created = {
    id: nextOpportunityId(),
    slug,
    keyword: candidate.keyword,
    status: 'candidate',
    origin: context.origin ?? 'estudio',
    /** Producto y cadena comercial del catalogo, si el termino corresponde a uno. */
    catalogLink: candidate.catalogLink ?? null,
    /** Que producto propone el sistema y en que se basa. */
    productHypothesis: candidate.productHypothesis ?? {
      status: 'none',
      productId: null,
      name: null,
      basis: null,
      confidence: null,
      note: 'Sin producto identificado.',
    },
    firstSeenAt: nowIso(),
    lastScanAt: nowIso(),
    revision: 1,
    decidedAt: null,
    decidedBy: null,
    decisionReason: null,
    latest: snapshot,
    revisions: [
      {
        revision: 1,
        at: nowIso(),
        score: snapshot.score,
        coverage: snapshot.coverage,
        verdict: snapshot.verdict,
        margin: snapshot.economics?.margin ?? null,
      },
    ],
  };

  store.opportunities.unshift(created);
  return serialize(created);
};

/**
 * Siembra la cola con la oportunidad que la demostracion tiene en marcha.
 *
 * Se hace con el mismo estudio que usaria el operador (fuente simulada), de modo que
 * la primera fila de la cola tiene exactamente la misma forma que las que se
 * registren despues, y el artefacto `opp-0001` del flujo apunta a algo que existe.
 */
let seeding = null;
export const ensureSeed = async () => {
  if (store.opportunities.length > 0) return;
  if (seeding) return seeding;

  seeding = (async () => {
    const result = await scan({
      keywords: DEMO_KEYWORDS,
      mode: 'simulated',
      constraints: { minMargin: 0.25 },
    });

    for (const candidate of result.candidates) {
      const registered = registerCandidate(candidate, {
        origin: 'demostracion',
        mode: result.mode,
        geo: null,
        timeframe: null,
        collectedAt: result.collectedAt,
      });

      // La primera es la que el flujo de demostracion esta ejecutando: se aprueba con su
      // producto ya resuelto (el soporte de monitor doble), porque es el caso que
      // recorre el ciclo completo.
      if (registered.id === 'opp-0001') {
        setProductHypothesis('opp-0001', {
          productId: 'prd-001',
          reason: 'Caso de demostracion: el ciclo completo produce el soporte de monitor doble.',
        });
        approveOpportunity('opp-0001', {
          reason: 'Oportunidad con la que se ejecuta el ciclo de demostracion.',
          by: 'operadora de demostracion',
        });
      }
    }
  })();

  try {
    await seeding;
  } finally {
    seeding = null;
  }
};

export const listOpportunities = ({ status, origin, minScore, search, sort = 'score' } = {}) => {
  const items = store.opportunities.filter(
    (opportunity) =>
      (status ? opportunity.status === status : true) &&
      (origin ? opportunity.origin === origin : true) &&
      (minScore === undefined ? true : (opportunity.latest?.score ?? -1) >= minScore) &&
      (search
        ? opportunity.keyword.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))
        : true),
  );

  const sorters = {
    score: (a, b) => (b.latest?.score ?? -1) - (a.latest?.score ?? -1),
    recent: (a, b) => new Date(b.lastScanAt).getTime() - new Date(a.lastScanAt).getTime(),
    coverage: (a, b) => (b.latest?.coverage ?? 0) - (a.latest?.coverage ?? 0),
    keyword: (a, b) => a.keyword.localeCompare(b.keyword, 'es'),
    status: (a, b) => a.status.localeCompare(b.status, 'es'),
  };

  return [...items].sort(sorters[sort] ?? sorters.score).map(serialize);
};

export const getOpportunity = (opportunityId) => {
  const opportunity = store.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) throw notFound(`No existe la oportunidad "${opportunityId}".`);
  return serialize(opportunity);
};

const decide = (opportunityId, status, { reason, by } = {}) => {
  const opportunity = store.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) throw notFound(`No existe la oportunidad "${opportunityId}".`);

  opportunity.status = status;
  opportunity.decidedAt = nowIso();
  opportunity.decidedBy = by ?? 'operadora de demostracion';
  opportunity.decisionReason = reason ?? null;

  return serialize(opportunity);
};

/**
 * Resuelve la situacion del producto a partir de lo que decida el operador.
 * Si no indica nada, se mantiene la hipotesis que ya tuviera la oportunidad.
 */
const resolveProductHypothesis = (opportunity, { productId, productName, asCategory, reason } = {}) => {
  const current = opportunity.productHypothesis ?? { status: 'none' };

  if (productId) {
    const link = catalogLinkForProduct(productId);
    if (!link) throw badRequest(`No existe el producto "${productId}" en el catalogo.`, { field: 'productId' });

    opportunity.catalogLink = link;
    return {
      status: 'confirmed',
      productId: link.productId,
      name: link.productName,
      basis: 'operador',
      confidence: 'alta',
      note: reason ?? 'Producto confirmado por el operador.',
      decidedAt: nowIso(),
    };
  }

  if (productName) {
    // Un producto que no esta en el catalogo es valido, pero sin enlace real: el flujo
    // producira artefactos derivados, no los de otro producto.
    opportunity.catalogLink = null;
    return {
      status: 'confirmed',
      productId: null,
      name: productName,
      basis: 'operador',
      confidence: 'alta',
      note: reason ?? 'Producto indicado por el operador (no esta en el catalogo).',
      decidedAt: nowIso(),
    };
  }

  if (asCategory) {
    opportunity.catalogLink = null;
    return {
      status: 'category',
      productId: null,
      name: null,
      basis: 'categoria',
      confidence: 'baja',
      note: reason ?? 'El operador aprueba la categoria sin un producto concreto.',
      decidedAt: nowIso(),
    };
  }

  return current;
};

/**
 * Fija el producto de una oportunidad sin aprobarla: el paso de aclaracion previo.
 */
export const setProductHypothesis = (opportunityId, options = {}) => {
  const opportunity = store.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) throw notFound(`No existe la oportunidad "${opportunityId}".`);

  if (!options.productId && !options.productName && !options.asCategory) {
    throw badRequest('Indica un productId, un productName o asCategory: true.', {
      fields: ['productId', 'productName', 'asCategory'],
    });
  }

  opportunity.productHypothesis = resolveProductHypothesis(opportunity, options);
  opportunity.updatedAt = nowIso();

  return serialize(opportunity);
};

/**
 * Aprueba una oportunidad: es el paso que la habilita para entrar al flujo.
 *
 * **No se puede aprobar sin saber que producto es.** Si el sistema solo ha reconocido
 * una categoria (o nada), el operador tiene que indicar el producto o decir
 * explicitamente que aprueba la categoria. Es la aclaracion que pide el primer filtro:
 * aprobar "perifericos gamer" sin saber si es un teclado, una webcam o un raton no es
 * una decision, es un clic.
 */
export const approveOpportunity = (opportunityId, { reason, by, productId, productName, asCategory } = {}) => {
  const opportunity = store.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) throw notFound(`No existe la oportunidad "${opportunityId}".`);

  const hypothesis = resolveProductHypothesis(opportunity, { productId, productName, asCategory, reason });
  opportunity.productHypothesis = hypothesis;

  const unresolved = hypothesis.status === 'none' || (hypothesis.status === 'proposed' && hypothesis.confidence !== 'alta');
  if (unresolved) {
    throw conflict(
      `«${opportunity.keyword}» no tiene un producto concreto identificado. Indica cual es, o aprueba la categoria explicitamente.`,
      {
        field: 'productHypothesis',
        situation: describeProductSituation(opportunity),
        productHypothesis: hypothesis,
      },
    );
  }

  opportunity.status = 'approved';
  opportunity.decidedAt = nowIso();
  opportunity.decidedBy = by ?? 'operadora de demostracion';
  opportunity.decisionReason = reason ?? 'Aprobada para entrar al flujo.';

  return serialize(opportunity);
};

/** Descarta una oportunidad. El motivo se guarda: es informacion para el proximo ciclo. */
export const discardOpportunity = (opportunityId, options) =>
  decide(opportunityId, 'discarded', { ...options, reason: options?.reason ?? 'Descartada por el operador.' });

/** Resumen de la cola: en que estado esta cada cosa y con cuanta evidencia. */
export const getOpportunitySummary = () => {
  const items = store.opportunities;
  const withScore = items.filter((opportunity) => typeof opportunity.latest?.score === 'number');

  return {
    totals: {
      total: items.length,
      candidate: items.filter((item) => item.status === 'candidate').length,
      approved: items.filter((item) => item.status === 'approved').length,
      discarded: items.filter((item) => item.status === 'discarded').length,
    },
    averageScore: withScore.length === 0 ? null : Math.round(withScore.reduce((total, item) => total + item.latest.score, 0) / withScore.length),
    /** Cuantas van con el estudio completo y cuantas con datos parciales. */
    byCoverage: {
      complete: items.filter((item) => (item.latest?.coverage ?? 0) >= 0.99).length,
      partial: items.filter((item) => (item.latest?.coverage ?? 0) > 0 && (item.latest?.coverage ?? 0) < 0.99).length,
      withoutData: items.filter((item) => !item.latest?.coverage).length,
    },
    /** Lo que se decidio y por que: trazabilidad de las decisiones del operador. */
    decisions: items
      .filter((item) => item.decidedAt)
      .sort((a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime())
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        keyword: item.keyword,
        status: item.status,
        at: item.decidedAt,
        by: item.decidedBy,
        reason: item.decisionReason,
      })),
  };
};

export const listOrigins = () => [...new Set(store.opportunities.map((item) => item.origin))].sort();

/**
 * Construye el contexto de ejecucion de una oportunidad.
 *
 * Regla del sistema: **solo se lanzan oportunidades aprobadas**. Es lo que convierte la
 * aprobacion en algo que de verdad hace algo, en lugar de ser una etiqueta.
 */
export const buildRunContext = (opportunityId) => {
  const opportunity = store.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity) throw notFound(`No existe la oportunidad "${opportunityId}".`);

  if (opportunity.status !== 'approved') {
    throw conflict(
      `La oportunidad "${opportunityId}" esta en estado "${opportunity.status}": solo se pueden lanzar oportunidades aprobadas.`,
      { opportunityId, status: opportunity.status },
    );
  }

  return {
    opportunityId: opportunity.id,
    keyword: opportunity.keyword,
    slug: opportunity.slug,
    catalogLink: opportunity.catalogLink ?? null,
    // Copia del estudio con el que se lanza: la ejecucion guarda la evidencia que tenia
    // en ese momento, aunque despues se vuelva a estudiar la oportunidad.
    opportunity: {
      id: opportunity.id,
      status: opportunity.status,
      latest: structuredClone(opportunity.latest),
    },
  };
};

/**
 * Lanza el flujo atado a una oportunidad aprobada.
 *
 * A partir de aqui, cada etapa produce artefactos de ESA oportunidad: sus cifras en las
 * metricas y, cuando el termino corresponde a un producto del catalogo, los registros
 * reales de la cadena; si no, propuestas marcadas como derivadas.
 */
export const launchRunForOpportunity = (opportunityId, { workflowId = DEFAULT_WORKFLOW_ID } = {}) => {
  const context = buildRunContext(opportunityId);
  const workflow = getWorkflowOrThrow(workflowId);

  const run = createRun(workflow, { context });

  pushActivity({
    type: 'workflow_stage',
    severity: 'info',
    actorAgentId: 'agt-020',
    departmentId: 'ops-center',
    message: `Yanca lanza "${workflow.name}" para la oportunidad aprobada «${context.keyword}».`,
    refs: [
      { type: 'opportunity', id: context.opportunityId, label: context.keyword },
      { type: 'workflow', id: workflow.id, label: workflow.name },
    ],
  });

  return serializeRun(run);
};
