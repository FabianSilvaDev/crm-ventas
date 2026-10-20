/**
 * Estudio de oportunidad: de señales sueltas a candidatas puntuadas.
 *
 * Es el primer paso real del intake. Convierte lo que devuelven las fuentes en
 * fichas comparables, y lo hace con tres compromisos explicitos:
 *
 *  - **Todo dato va con su fuente** (la señal viaja entera hasta la ficha).
 *  - **No se inventa lo que falta.** Si no hay coste, no hay margen: la ficha dice
 *    que falta ese dato en lugar de rellenarlo.
 *  - **La puntuacion declara su cobertura.** Un 80 sobre dos metricas de seis no vale
 *    lo mismo que un 80 sobre seis, y eso se ve en `coverage` y en `missing`.
 */
import { config } from '../config.js';
import { campaigns, landingPages, offers, products } from '../mocks/index.js';
import { collectSignals, listSources } from '../sources/index.js';
import { proposeProduct } from '../sources/simulated.source.js';
import { metricDefinition, round2 } from '../sources/signal.js';

/** Peso de cada metrica en la puntuacion, antes de normalizar por disponibilidad. */
const WEIGHTS = {
  demand: 0.3,
  margin: 0.25,
  competition: 0.2,
  momentum: 0.1,
  salesVolume: 0.1,
  cost: 0.05,
};

/** Metricas que se esperan en un estudio completo. */
const EXPECTED_METRICS = ['demand', 'momentum', 'cost', 'competition', 'salesVolume'];

export const DEFAULT_CONSTRAINTS = {
  /** Margen minimo exigido (0-1). */
  minMargin: 0.3,
  /** Coste maximo asumible por unidad. */
  maxCost: null,
  /** Maximo de ofertas comparables que se considera competencia asumible. */
  maxCompetition: null,
  /** Precio de venta esperado en tu mercado, si no lo aporta ninguna fuente. */
  expectedSalePrice: null,
};

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const logScale = (value, ceiling) => clamp(Math.log10(Math.max(1, value)) / ceiling, 0, 1);

/** Valor normalizado de cada metrica, en la direccion en la que "mejor" es mas alto. */
const normalize = (metric, value, constraints) => {
  switch (metric) {
    case 'demand':
      return clamp(value / 100);
    case 'momentum':
      // -50% se considera malo, +50% bueno.
      return clamp((value + 50) / 100);
    case 'margin':
      // Un 60% de margen ya se lleva la puntuacion completa.
      return clamp(value / 0.6);
    case 'competition':
      return constraints.maxCompetition
        ? 1 - clamp(value / constraints.maxCompetition)
        : 1 - logScale(value, 3);
    case 'salesVolume':
      return logScale(value, 3.5);
    case 'cost':
      return constraints.maxCost ? 1 - clamp(value / constraints.maxCost) : null;
    default:
      return null;
  }
};

/** Agrupa las señales por termino, quedandose con la de mayor confianza de cada metrica. */
const groupByKeyword = (signals) => {
  const grouped = new Map();

  for (const signal of signals) {
    const entry = grouped.get(signal.keyword) ?? new Map();
    const existing = entry.get(signal.metric);

    if (!existing || signal.confidence > existing.confidence) entry.set(signal.metric, signal);
    grouped.set(signal.keyword, entry);
  }

  return grouped;
};

const expectedSalePriceFor = (constraints, keyword) => {
  const configured = constraints.expectedSalePrice;
  if (typeof configured === 'number') return configured;
  if (configured && typeof configured === 'object') return configured[keyword] ?? null;
  return null;
};

/**
 * Hipotesis de producto para un termino.
 *
 * Es lo que responde a "vale, acepto la oportunidad... pero ¿que producto es?".
 * `confidence: 'baja'` significa que el sistema solo ha reconocido una CATEGORIA (o
 * nada): en ese caso el producto es una propuesta de ejemplo y debe confirmarlo el
 * operador antes de aprobar.
 */
export const productHypothesisFor = (keyword) => {
  const proposal = proposeProduct(keyword);

  if (!proposal) {
    return {
      status: 'none',
      productId: null,
      name: null,
      basis: null,
      confidence: null,
      note: 'No se ha identificado ningun producto del catalogo para este termino: hay que indicar cual es antes de aprobar.',
    };
  }

  return {
    status: 'proposed',
    productId: proposal.product.id,
    name: proposal.product.name,
    basis: proposal.basis,
    confidence: proposal.confidence,
    note: proposal.note,
  };
};

/**
 * Enlace con la cadena comercial de un producto concreto del catalogo.
 */
export const catalogLinkForProduct = (productId) => {
  const product = products.find((item) => item.id === productId);
  if (!product) return null;

  const offer = offers.find((item) => item.id === product.offerId) ?? null;
  const landing = offer ? (landingPages.find((page) => page.offerId === offer.id) ?? null) : null;
  const campaign = offer ? (campaigns.find((item) => item.offerId === offer.id) ?? null) : null;

  return {
    productId: product.id,
    productName: product.name,
    offerId: offer?.id ?? null,
    offerName: offer?.name ?? null,
    landingPageId: landing?.id ?? null,
    landingPageSlug: landing?.slug ?? null,
    campaignId: campaign?.id ?? null,
    campaignName: campaign?.name ?? null,
  };
};

/**
 * Enlace con el catalogo a partir del termino, SOLO cuando la propuesta es fiable.
 *
 * Con una coincidencia por categoria (`confidence: 'baja'`) no se enlaza nada: si se
 * enlazara, el flujo acabaria produciendo los artefactos reales de un producto que el
 * operador no ha elegido.
 */
export const catalogLinkFor = (keyword) => {
  const proposal = proposeProduct(keyword);
  if (!proposal || proposal.confidence !== 'alta') return null;
  return catalogLinkForProduct(proposal.product.id);
};

/** Metrica sin dato: se muestra 0 y se marca como tal; no puntua ni cuenta para la cobertura. */
const unavailableComponent = (keyword, metric, reason) => {
  const definition = metricDefinition(metric);

  return {
    keyword,
    metric,
    metricLabel: definition.label,
    value: 0,
    unit: definition.unit,
    better: definition.better,
    confidence: 0,
    available: false,
    normalized: null,
    weight: 0,
    source: { id: 'none', name: 'Sin datos', kind: 'none', mode: 'none' },
    collectedAt: null,
    evidence: { note: `${reason} Se muestra 0, no una estimacion.` },
  };
};
export const buildCandidate = (keyword, metricSignals, constraints) => {
  const cost = metricSignals.get('cost')?.value ?? null;
  const marketPrice = metricSignals.get('price')?.value ?? null;
  const expectedSalePrice = expectedSalePriceFor(constraints, keyword);
  const salePrice = marketPrice ?? expectedSalePrice;

  // El margen solo existe si hay coste y un precio de referencia; si no, se declara ausente.
  const marginAssumed = marketPrice === null && expectedSalePrice !== null;
  const margin = cost !== null && salePrice !== null && salePrice > 0 ? (salePrice - cost) / salePrice : null;

  const components = [];
  const missing = [];

  for (const metric of [...EXPECTED_METRICS, 'margin']) {
    if (metric === 'margin') {
      if (margin === null) {
        const reason = cost === null ? 'Falta el coste de compra.' : 'Falta un precio de venta de referencia.';
        missing.push({ metric, label: 'Margen', reason });
        components.push(unavailableComponent(keyword, 'margin', reason));
        continue;
      }

      components.push({
        metric,
        metricLabel: 'Margen estimado',
        value: round2(margin),
        unit: '%',
        available: true,
        normalized: normalize('margin', margin, constraints),
        weight: WEIGHTS.margin,
        confidence: marginAssumed ? 0.4 : 0.65,
        source: marketPrice !== null ? metricSignals.get('price')?.source : null,
        collectedAt: metricSignals.get('cost')?.collectedAt ?? null,
        evidence: {
          note: marginAssumed
            ? `Calculado con el precio de venta que has indicado (${expectedSalePrice} EUR) menos el coste observado.`
            : 'Calculado con el precio de venta y el coste observados en las fuentes.',
        },
      });
      continue;
    }

    const signal = metricSignals.get(metric);
    if (!signal) {
      const reason = 'Ninguna fuente ha aportado este dato.';
      missing.push({ metric, label: metricDefinition(metric).label, reason });
      // Se muestra a 0 en la ficha, pero SIN contarlo como valor: no puntua ni cubre.
      components.push(unavailableComponent(keyword, metric, reason));
      continue;
    }

    const normalized = normalize(metric, signal.value, constraints);
    if (normalized === null) {
      // El dato EXISTE, pero sin una referencia no se puede puntuar. Se muestra con su
      // valor y su fuente, y no pesa en la puntuacion: es distinto de "no hay dato".
      const reason = 'Sin referencia para puntuarla (indica un maximo en las restricciones).';
      missing.push({ metric, label: metricDefinition(metric).label, reason });
      components.push({
        ...signal,
        available: true,
        normalized: null,
        weight: 0,
        evidence: {
          ...signal.evidence,
          note: [signal.evidence?.note, 'No puntua: falta una referencia con la que compararla.']
            .filter(Boolean)
            .join(' '),
        },
      });
      continue;
    }

    components.push({ ...signal, available: true, normalized, weight: WEIGHTS[metric] ?? 0.05 });
  }

  const availableWeight = components.reduce((total, component) => total + component.weight, 0);
  const availableComponents = components.filter((component) => component.available);
  const totalWeight = Object.values(WEIGHTS).reduce((total, weight) => total + weight, 0);
  const score =
    availableWeight === 0
      ? null
      : Math.round((components.reduce((total, c) => total + c.normalized * c.weight, 0) / availableWeight) * 100);

  const checks = [
    margin === null
      ? { constraint: 'minMargin', passed: null, detail: 'No se puede comprobar: falta el margen.' }
      : {
          constraint: 'minMargin',
          passed: margin >= constraints.minMargin,
          detail: `Margen ${(margin * 100).toFixed(1)}% frente al minimo ${(constraints.minMargin * 100).toFixed(0)}%.`,
        },
    constraints.maxCost === null
      ? { constraint: 'maxCost', passed: null, detail: 'Sin coste maximo definido.' }
      : cost === null
        ? { constraint: 'maxCost', passed: null, detail: 'No se puede comprobar: falta el coste.' }
        : {
            constraint: 'maxCost',
            passed: cost <= constraints.maxCost,
            detail: `Coste ${cost} EUR frente al maximo ${constraints.maxCost} EUR.`,
          },
    constraints.maxCompetition === null
      ? { constraint: 'maxCompetition', passed: null, detail: 'Sin limite de competencia definido.' }
      : {
          constraint: 'maxCompetition',
          passed: (metricSignals.get('competition')?.value ?? 0) <= constraints.maxCompetition,
          detail: `${metricSignals.get('competition')?.value ?? 'sin dato'} ofertas frente al maximo ${constraints.maxCompetition}.`,
        },
  ];

  const failed = checks.filter((check) => check.passed === false);
  const unknown = checks.filter((check) => check.passed === null);
  const coverage = round2(availableWeight / totalWeight);

  return {
    keyword,
    score,
    coverage,
    /** Confianza media de los datos usados: a mas fuentes reales, mas alta. */
    confidence:
      availableComponents.length === 0
        ? 0
        : round2(availableComponents.reduce((total, component) => total + component.confidence, 0) / availableComponents.length),
    verdict: failed.length > 0 ? 'no cumple' : unknown.length === checks.length ? 'sin datos suficientes' : 'cumple',
    components,
    missing,
    /** Producto del catalogo al que corresponde el termino, si existe. */
    catalogLink: catalogLinkFor(keyword),
    /** Que producto propone el sistema y en que se basa (o por que no propone ninguno). */
    productHypothesis: productHypothesisFor(keyword),
    economics: {
      cost,
      marketPrice,
      expectedSalePrice,
      margin: margin === null ? null : round2(margin),
      marginAssumed,
    },
    checks,
    signals: [...metricSignals.values()],
  };
};

/**
 * Ejecuta un estudio de oportunidad sobre una lista de terminos.
 * @param {object} options
 * @param {string[]} options.keywords
 * @param {object} [options.constraints]
 * @param {'auto'|'live'|'simulated'} [options.mode]
 */
export const scan = async ({ keywords = [], constraints = {}, mode, geo, timeframe } = {}) => {
  const effectiveConstraints = { ...DEFAULT_CONSTRAINTS, ...constraints };
  // La ventana y la geografia efectivas se devuelven con el resultado: forman parte
  // de la trazabilidad de cada cifra.
  const geoUsed = geo ?? config.trends.geo;
  const timeframeUsed = timeframe ?? config.trends.timeframe;

  const collection = await collectSignals({ keywords, geo: geoUsed, timeframe: timeframeUsed, mode });
  const grouped = groupByKeyword(collection.signals);

  const candidates = keywords.map((keyword) =>
    grouped.has(keyword)
      ? buildCandidate(keyword, grouped.get(keyword), effectiveConstraints)
      : {
          keyword,
          score: null,
          coverage: 0,
          confidence: 0,
          verdict: 'sin datos suficientes',
          components: [],
          missing: [{ metric: '*', label: 'Todo', reason: 'Ninguna fuente ha devuelto datos para este termino.' }],
          economics: { cost: null, marketPrice: null, expectedSalePrice: null, margin: null, marginAssumed: false },
          checks: [],
          signals: [],
        },
  );

  return {
    keywords,
    constraints: effectiveConstraints,
    mode: collection.mode,
    geo: geoUsed,
    timeframe: timeframeUsed,
    collectedAt: collection.collectedAt,
    /** Ordenadas por puntuacion: lo primero que deberia mirar el operador. */
    candidates: candidates.sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    signals: collection.signals,
    sources: collection.sources,
    notes: collection.notes,
    /** Restricciones y pesos vigentes, para que la vista pueda explicar la puntuacion. */
    method: {
      weights: WEIGHTS,
      expectedMetrics: EXPECTED_METRICS,
      defaults: DEFAULT_CONSTRAINTS,
    },
  };
};

/** Estado de las fuentes de datos del estudio. */
export const getSources = () => ({
  mode: config.sources.mode,
  sources: listSources(),
});
