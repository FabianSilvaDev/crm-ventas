/**
 * Cola de oportunidades: consulta, decision del operador y descubrimiento de terminos.
 */
import { badRequest } from '../errors.js';
import {
  OPPORTUNITY_STATUSES,
  approveOpportunity,
  discardOpportunity,
  ensureSeed,
  getOpportunity,
  getOpportunitySummary,
  launchRunForOpportunity,
  listOpportunities,
  listOrigins,
  setProductHypothesis,
} from '../services/opportunities.service.js';
import { discoverRisingTerms } from '../sources/index.js';
import { asyncHandler, accepted, ok, paginated } from '../utils/http.js';
import { paginate, parseEnum, parseIntParam, parsePagination, requireString } from '../utils/validate.js';

const SORTS = ['score', 'recent', 'coverage', 'keyword', 'status'];

export const readOpportunities = asyncHandler(async (req, res) => {
  await ensureSeed();

  const pagination = parsePagination(req.query);
  const items = listOpportunities({
    status: parseEnum(req.query.status, OPPORTUNITY_STATUSES, 'status'),
    origin: req.query.origin,
    minScore: parseIntParam(req.query.minScore, 'minScore', { min: 0, max: 100 }),
    search: req.query.search,
    sort: parseEnum(req.query.sort, SORTS, 'sort', 'score'),
  });
  const page = paginate(items, pagination);

  paginated(res, page.items, {
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    extra: { filters: { statuses: OPPORTUNITY_STATUSES, origins: listOrigins(), sorts: SORTS } },
  });
});

export const readOpportunitySummary = asyncHandler(async (_req, res) => {
  await ensureSeed();
  ok(res, getOpportunitySummary());
});

export const readOpportunity = asyncHandler(async (req, res) => {
  await ensureSeed();
  ok(res, getOpportunity(req.params.id));
});

/**
 * Aprobar es lo que habilita una oportunidad para entrar al flujo.
 *
 * El cuerpo puede aclarar el producto en el mismo paso:
 * `{ productId, productName, asCategory, reason }`.
 */
export const approve = asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  ok(
    res,
    approveOpportunity(req.params.id, {
      reason: body.reason === undefined ? undefined : requireString(body.reason, 'reason', { maxLength: 240 }),
      productId: body.productId === undefined ? undefined : requireString(body.productId, 'productId', { maxLength: 40 }),
      productName:
        body.productName === undefined ? undefined : requireString(body.productName, 'productName', { maxLength: 120 }),
      asCategory: body.asCategory === true,
    }),
  );
});

/**
 * Aclara (sin aprobar) que producto es. Es el paso previo del filtro de oportunidad.
 */
export const setProduct = asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  ok(
    res,
    setProductHypothesis(req.params.id, {
      reason: body.reason === undefined ? undefined : requireString(body.reason, 'reason', { maxLength: 240 }),
      productId: body.productId === undefined ? undefined : requireString(body.productId, 'productId', { maxLength: 40 }),
      productName:
        body.productName === undefined ? undefined : requireString(body.productName, 'productName', { maxLength: 120 }),
      asCategory: body.asCategory === true,
    }),
  );
});

/** Descartar guarda el motivo: es informacion para el siguiente ciclo. */
export const discard = asyncHandler(async (req, res) => {
  const reason = req.body?.reason === undefined ? undefined : requireString(req.body.reason, 'reason', { maxLength: 240 });
  ok(res, discardOpportunity(req.params.id, { reason }));
});

/**
 * Lanza el flujo atado a una oportunidad aprobada.
 * Responde 202: la simulacion avanza en segundo plano y se sigue por polling.
 */
export const launch = asyncHandler(async (req, res) => {
  const workflowId =
    req.body?.workflowId === undefined ? undefined : requireString(req.body.workflowId, 'workflowId', { maxLength: 60 });

  const run = launchRunForOpportunity(req.params.id, { workflowId });

  accepted(res, run, {
    note: 'Ejecucion creada con el contexto de la oportunidad: sus etapas produciran artefactos de ESA oportunidad.',
  });
});

/** Descubrimiento de terminos que estan subiendo (Google Trends). */
export const discover = asyncHandler(async (req, res) => {
  const geo = req.query.geo === undefined ? undefined : requireString(req.query.geo, 'geo', { maxLength: 8 });
  const limit = parseIntParam(req.query.limit, 'limit', { min: 1, max: 25, fallback: 10 });

  if (req.query.geo !== undefined && !/^[A-Za-z]{2}(-[A-Za-z]{2})?$/.test(String(req.query.geo))) {
    throw badRequest('"geo" debe ser un codigo de pais de dos letras (por ejemplo ES).', { field: 'geo' });
  }

  const result = await discoverRisingTerms({ geo, limit });
  ok(res, result, { note: result.caveat ?? undefined });
});
