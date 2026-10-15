/**
 * Estudio de oportunidad y estado de las fuentes de datos.
 */
import { getSources, scan } from '../services/intake.service.js';
import { ensureSeed, registerCandidate } from '../services/opportunities.service.js';
import { asyncHandler, ok } from '../utils/http.js';
import { badRequest } from '../errors.js';
import { parseEnum, requireString } from '../utils/validate.js';

const MAX_KEYWORDS = 8;

/** Valida y normaliza la lista de terminos a estudiar. */
const parseKeywords = (value) => {
  if (!Array.isArray(value)) {
    throw badRequest('El parametro "keywords" debe ser una lista de terminos.', { field: 'keywords' });
  }

  const keywords = [...new Set(value.map((item) => requireString(item, 'keywords[]', { maxLength: 60 })))];

  if (keywords.length === 0) {
    throw badRequest('Indica al menos un termino para estudiar.', { field: 'keywords' });
  }
  if (keywords.length > MAX_KEYWORDS) {
    throw badRequest(`Se admiten como maximo ${MAX_KEYWORDS} terminos por estudio.`, {
      field: 'keywords',
      max: MAX_KEYWORDS,
      received: keywords.length,
    });
  }

  return keywords;
};

/** Valida las restricciones del operador. Solo se aceptan numeros razonables. */
const parseConstraints = (value) => {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest('El parametro "constraints" debe ser un objeto.', { field: 'constraints' });
  }

  const constraints = {};

  if (value.minMargin !== undefined) {
    const margin = Number(value.minMargin);
    if (!Number.isFinite(margin) || margin < 0 || margin > 1) {
      throw badRequest('"constraints.minMargin" debe ser una proporcion entre 0 y 1.', { field: 'minMargin' });
    }
    constraints.minMargin = margin;
  }

  for (const field of ['maxCost', 'expectedSalePrice']) {
    if (value[field] === undefined || value[field] === null) continue;

    // El precio de venta esperado admite un valor o un mapa por termino.
    if (field === 'expectedSalePrice' && typeof value[field] === 'object' && !Array.isArray(value[field])) {
      const map = {};
      for (const [keyword, price] of Object.entries(value[field])) {
        const parsed = Number(price);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          throw badRequest(`"constraints.expectedSalePrice.${keyword}" debe ser un numero positivo.`, { field });
        }
        map[keyword] = parsed;
      }
      constraints[field] = map;
      continue;
    }

    const parsed = Number(value[field]);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw badRequest(`"constraints.${field}" debe ser un numero positivo.`, { field });
    }
    constraints[field] = parsed;
  }

  if (value.maxCompetition !== undefined && value.maxCompetition !== null) {
    const parsed = Number(value.maxCompetition);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw badRequest('"constraints.maxCompetition" debe ser un entero positivo.', { field: 'maxCompetition' });
    }
    constraints.maxCompetition = parsed;
  }

  return constraints;
};

export const readSources = asyncHandler((_req, res) => {
  ok(res, getSources());
});

/**
 * Ejecuta un estudio de oportunidad y registra las candidatas en la cola.
 * Es una operacion supervisada y puede tardar: consulta fuentes externas.
 *
 * Con `register: false` el estudio es una simulacion y no deja rastro en la cola.
 */
export const runScan = asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  // La cola se siembra antes de registrar nada, para que los identificadores de la
  // demostracion sean estables.
  await ensureSeed();

  const result = await scan({
    keywords: parseKeywords(body.keywords),
    constraints: parseConstraints(body.constraints),
    mode: parseEnum(body.mode, ['auto', 'live', 'simulated'], 'mode'),
    geo: body.geo === undefined ? undefined : requireString(body.geo, 'geo', { maxLength: 8 }),
    timeframe: body.timeframe === undefined ? undefined : requireString(body.timeframe, 'timeframe', { maxLength: 30 }),
  });

  if (body.register === false) {
    ok(res, { ...result, registered: [] }, { note: 'Estudio sin registrar: no se ha modificado la cola.' });
    return;
  }

  const registered = result.candidates.map((candidate) =>
    registerCandidate(candidate, {
      origin: 'estudio',
      mode: result.mode,
      geo: result.geo,
      timeframe: result.timeframe,
      collectedAt: result.collectedAt,
    }),
  );
  const byKeyword = new Map(registered.map((item) => [item.keyword, item]));

  ok(
    res,
    {
      ...result,
      candidates: result.candidates.map((candidate) => ({
        ...candidate,
        opportunityId: byKeyword.get(candidate.keyword)?.id ?? null,
        opportunityStatus: byKeyword.get(candidate.keyword)?.status ?? null,
      })),
      registered: registered.map((item) => ({
        id: item.id,
        keyword: item.keyword,
        status: item.status,
        revision: item.revision,
      })),
    },
    {
      note: 'Cada cifra viaja con su fuente y su fecha. Los datos simulados van marcados como tales.',
    },
  );
});
