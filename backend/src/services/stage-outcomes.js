/**
 * Resolucion del resultado de cada etapa del flujo.
 *
 * Hay dos caminos, y la diferencia importa:
 *
 *  1. **Sin contexto** (demostracion pura): se usa el resultado previsto de la
 *     plantilla, que cuenta el caso de "Soporte de monitor doble".
 *  2. **Con una oportunidad** (`run.context`): el resultado se construye a partir del
 *     estudio registrado de ESA oportunidad. Sus cifras (demanda, coste, margen,
 *     competencia) son las de su ficha, no las de otro producto.
 *
 * Regla de honestidad en el camino 2: si la oportunidad corresponde a un producto del
 * catalogo, los artefactos apuntan a los registros reales (`prd-001`, `off-0001`...);
 * si no, se marca `derived: true` y la interfaz los muestra como propuesta, no como
 * algo que exista en el catalogo. Y cuando una etapa no tiene dato real que usar, su
 * resumen lo dice en lugar de rellenarlo.
 */
import { stageByKey } from '../mocks/index.js';

const metric = (label, value) => ({ label, value: value === null || value === undefined ? 'sin dato' : String(value) });

/** Valor de una metrica del estudio de la oportunidad, o `null` si no se obtuvo. */
const valueOf = (opportunity, metricName) =>
  opportunity?.latest?.components?.find((component) => component.metric === metricName)?.value ?? null;

/** Como llamar a la procedencia de los datos en el texto del resultado. */
const sourceLabel = (opportunity) => {
  const modes = new Set((opportunity?.latest?.components ?? []).map((component) => component.source.mode));
  if (modes.size === 0) return 'sin datos de fuente';
  return modes.has('live') ? 'fuentes reales' : 'datos de demostracion';
};

const percent = (value) => (value === null ? null : `${(value * 100).toFixed(1)}%`);

/**
 * Resultado derivado por etapa. Cada entrada devuelve el resumen, las metricas y el
 * artefacto propuesto cuando la etapa no tiene un registro real en el catalogo.
 */
const DERIVED_OUTCOMES = {
  opportunity: (context) => ({
    summary: `Oportunidad «${context.keyword}» registrada y priorizada para investigacion.`,
    metrics: [
      metric('Puntuacion', context.opportunity?.latest?.score),
      metric('Cobertura del estudio', percent(context.opportunity?.latest?.coverage)),
      metric('Margen estimado', percent(context.opportunity?.latest?.economics?.margin)),
    ],
    // El registro de la oportunidad SI existe: no es una propuesta.
    artifact: { type: 'opportunity', id: context.opportunityId, label: context.keyword, real: true },
  }),

  research: (context) => {
    // Si la etapa ha consultado las fuentes, manda el informe real: sus cifras, sus
    // hallazgos y su identificador (que existe en /research). Si no, se dice por que.
    const report = context.research;
    if (report) {
      return {
        summary: report.summary,
        metrics: (report.metrics ?? []).slice(0, 4).map((metric) => ({ label: metric.label, value: metric.value })),
        artifact: { type: 'research', id: report.id, label: report.title, real: true },
      };
    }

    const failure = context.researchError
      ? ` No se pudo consultar las fuentes a tiempo: ${context.researchError}`
      : ' La consulta a fuentes no habia terminado cuando la etapa se completo.';

    return {
      summary: `Informe de mercado de «${context.keyword}» a partir de ${sourceLabel(context.opportunity)}.${failure}`,
      metrics: [
        metric('Demanda', valueOf(context.opportunity, 'demand')),
        metric('Competencia (ofertas)', valueOf(context.opportunity, 'competition')),
        metric('Muestra de mercado', valueOf(context.opportunity, 'salesVolume')),
      ],
      artifact: { type: 'research', label: `Informe de mercado: ${context.keyword}` },
    };
  },

  'market-intelligence': (context) => ({
    summary: `Inteligencia de mercado de «${context.keyword}»: se cruza la tendencia con el margen para decidir el angulo de entrada.`,
    metrics: [
      metric('Tendencia', valueOf(context.opportunity, 'momentum')),
      metric('Demanda', valueOf(context.opportunity, 'demand')),
    ],
    artifact: { type: 'research', label: `Mapa de tendencias: ${context.keyword}` },
  }),

  'competitor-analysis': (context) => ({
    summary: `Analisis competitivo de «${context.keyword}» con las ofertas comparables encontradas.`,
    metrics: [
      metric('Ofertas comparables', valueOf(context.opportunity, 'competition')),
      metric('Precio de mercado', valueOf(context.opportunity, 'price')),
      metric('Coste observado', context.opportunity?.latest?.economics?.cost),
    ],
    artifact: { type: 'research', label: `Matriz competitiva: ${context.keyword}` },
  }),

  'product-validation': (context) => ({
    summary: `Validacion de «${context.keyword}»: ${context.opportunity?.latest?.verdict ?? 'sin veredicto'} con los criterios del operador.`,
    metrics: [
      metric('Puntuacion', context.opportunity?.latest?.score),
      metric('Margen estimado', percent(context.opportunity?.latest?.economics?.margin)),
      metric('Datos ausentes', context.opportunity?.latest?.missing?.length ?? 0),
    ],
    artifact: { type: 'product', label: `Propuesta de producto: ${context.keyword}` },
  }),

  'offer-creation': (context) => {
    const price = valueOf(context.opportunity, 'price') ?? context.opportunity?.latest?.economics?.marketPrice;
    return {
      summary: `Oferta propuesta para «${context.keyword}» con tres niveles anclados en el precio observado.`,
      metrics: [
        metric('Precio de mercado', price),
        metric('Nivel base', price === null ? null : Math.round(price * 0.85)),
        metric('Nivel alto', price === null ? null : Math.round(price * 1.35)),
        metric('Margen estimado', percent(context.opportunity?.latest?.economics?.margin)),
      ],
      artifact: { type: 'offer', label: `Oferta propuesta: ${context.keyword}` },
    };
  },

  'content-generation': (context) => ({
    summary: `Contenido generado para la oferta de «${context.keyword}». Piezas simuladas: en esta version no hay fuente real de copy.`,
    metrics: [metric('Piezas', 18), metric('Titulares A/B', 6)],
    artifact: { type: 'content', label: `Kit de contenido: ${context.keyword}` },
  }),

  'creative-production': (context) => ({
    summary: `Creatividades producidas para «${context.keyword}» (variantes simuladas, sin fuente real de diseno).`,
    metrics: [metric('Formatos', 9), metric('Variantes', 12)],
    artifact: { type: 'creative', label: `Kit de creatividades: ${context.keyword}` },
  }),

  'landing-page': (context) => ({
    summary: `Landing publicada para «${context.keyword}» con dos variantes para probar. Conversion simulada.`,
    metrics: [metric('Variantes', 2), metric('Conversion variante B', '3,1%')],
    artifact: { type: 'landing-page', label: `/propuesta-${context.slug}` },
  }),

  'campaign-setup': (context) => ({
    summary: `Campana configurada para «${context.keyword}» en tres canales simulados.`,
    metrics: [metric('Canales', 3), metric('Grupos de anuncios', 9)],
    artifact: { type: 'campaign', label: `Campana: ${context.keyword}` },
  }),

  'audience-budget': (context) => ({
    summary: `Audiencias y presupuesto repartidos para «${context.keyword}».`,
    metrics: [metric('Audiencias', 4), metric('Presupuesto', '6.400 EUR'), metric('CPC objetivo', '0,62 EUR')],
    artifact: { type: 'campaign', label: `Campana: ${context.keyword}` },
  }),

  'lead-acquisition': (context) => ({
    summary: `Captacion de leads para «${context.keyword}» (volumen simulado a partir de la demanda registrada).`,
    metrics: [
      metric('Leads', valueOf(context.opportunity, 'demand') === null ? 146 : Math.round(valueOf(context.opportunity, 'demand') * 1.8)),
      metric('Coste por lead', '8,40 EUR'),
    ],
    artifact: { type: 'lead', label: `Lote de leads: ${context.keyword}` },
  }),

  'lead-qualification': (context) => ({
    summary: `Cualificacion de los leads de «${context.keyword}» con los criterios de encaje.`,
    metrics: [metric('Cualificados', 60), metric('Tasa', '41%'), metric('Duplicados', 9)],
    artifact: { type: 'lead', label: `Leads cualificados: ${context.keyword}` },
  }),

  'sales-follow-up': (context) => ({
    summary: `Seguimiento comercial de «${context.keyword}» (secuencia simulada).`,
    metrics: [metric('Propuestas', 24), metric('Cierres', 11), metric('Valor cerrado', '9.880 EUR')],
    artifact: { type: 'lead', label: `Oportunidades en seguimiento: ${context.keyword}` },
  }),

  analytics: (context) => ({
    summary: `Medicion del ciclo de «${context.keyword}»: atribucion y desviaciones.`,
    metrics: [metric('Conversiones', 146), metric('ROAS simulado', '3,4x'), metric('Coste por conversion', '14,20 EUR')],
    artifact: { type: 'analytics', label: `Informe del ciclo: ${context.keyword}` },
  }),

  optimization: (context) => ({
    summary: `Optimizaciones propuestas para «${context.keyword}» a partir de los resultados del ciclo.`,
    metrics: [metric('Hipotesis', 7), metric('Conversion', '2,6%')],
    artifact: { type: 'analytics', label: `Plan de optimizacion: ${context.keyword}` },
  }),

  learning: (context) => {
    const missing = context.opportunity?.latest?.missing ?? [];
    return {
      // El aprendizaje mas util de este ciclo es lo que NO se pudo saber.
      summary:
        missing.length > 0
          ? `Lecciones de «${context.keyword}»: el estudio se cerro con ${missing.length} dato(s) ausente(s) (${missing.map((item) => item.label).join(', ')}). Conviene conseguirlos antes del proximo ciclo.`
          : `Lecciones de «${context.keyword}»: el estudio se completo con toda la evidencia disponible.`,
      metrics: [
        metric('Cobertura', percent(context.opportunity?.latest?.coverage)),
        metric('Veredicto', context.opportunity?.latest?.verdict),
        metric('Fuentes usadas', sourceLabel(context.opportunity)),
      ],
      artifact: { type: 'learning', label: `Lecciones: ${context.keyword}` },
    };
  },
};

/**
 * Artefactos REALES del catalogo para una etapa, cuando la oportunidad esta ligada a un
 * producto existente. Si devuelve `null`, la etapa propone un artefacto derivado.
 */
const catalogArtifact = (stageKey, link) => {
  if (!link) return null;

  const byStage = {
    'product-validation': link.productId
      ? { type: 'product', id: link.productId, label: link.productName }
      : null,
    'offer-creation': link.offerId ? { type: 'offer', id: link.offerId, label: link.offerName } : null,
    'landing-page': link.landingPageId
      ? { type: 'landing-page', id: link.landingPageId, label: link.landingPageSlug }
      : null,
    'campaign-setup': link.campaignId ? { type: 'campaign', id: link.campaignId, label: link.campaignName } : null,
    'audience-budget': link.campaignId ? { type: 'campaign', id: link.campaignId, label: link.campaignName } : null,
  };

  return byStage[stageKey] ?? null;
};

/**
 * Resultado de una etapa.
 *
 * @param {string} stageKey
 * @param {object|null} context `run.context`, con la oportunidad y su enlace al catalogo.
 */
export const resolveOutcome = (stageKey, context) => {
  const blueprint = stageByKey.get(stageKey);
  if (!blueprint) return { summary: '', metrics: [], artifacts: [] };

  // Sin oportunidad: comportamiento de demostracion, sin cambios.
  if (!context?.opportunityId) return blueprint.outcome;

  const derived = DERIVED_OUTCOMES[stageKey];
  if (!derived) return blueprint.outcome;

  const outcome = derived(context);
  const proposed = outcome.artifact ?? null;

  /**
   * Un artefacto es real cuando apunta a algo que existe: los registros del catalogo de
   * la cadena, o la propia oportunidad. Todo lo demas es una propuesta y se marca como
   * derivada para que la interfaz no la presente como si estuviera en el catalogo.
   */
  const real = catalogArtifact(stageKey, context.catalogLink) ?? (proposed?.real ? proposed : null);

  let artifact = null;
  if (real) {
    const { real: _marker, ...rest } = real;
    artifact = { ...rest, derived: false };
  } else if (proposed) {
    artifact = { ...proposed, id: proposed.id ?? `${context.opportunityId}:${stageKey}`, derived: true };
  }

  return {
    summary: outcome.summary,
    metrics: outcome.metrics,
    artifacts: artifact ? [artifact] : [],
  };
};
