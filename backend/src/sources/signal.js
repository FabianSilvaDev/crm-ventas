/**
 * Modelo de señal.
 *
 * Una señal es UN dato concreto con su procedencia: la metrica, el valor, la fuente
 * que lo ha producido, cuando se recogio y con cuanta confianza. Es la pieza que
 * evita el problema de fondo de este modulo: un `demanda: 74` sin fuente es una
 * opinion con formato de dato.
 *
 * Las fuentes devuelven señales PARCIALES (sin `source` ni `collectedAt`): el
 * registro (`index.js`) es quien las sella, de modo que ninguna señal puede llegar
 * al operador sin decir de donde sale.
 */

/** Catalogo de metricas: etiqueta, unidad y en que direccion mejora. */
export const METRICS = {
  demand: { label: 'Demanda', unit: 'indice 0-100', better: 'higher', description: 'Interes de busqueda relativo en la ventana consultada.' },
  momentum: { label: 'Tendencia', unit: '% vs periodo anterior', better: 'higher', description: 'Variacion del interes en el ultimo tramo respecto al anterior.' },
  price: { label: 'Precio de venta', unit: 'EUR', better: 'neutral', description: 'Precio al que se esta vendiendo el producto en el mercado.' },
  cost: { label: 'Coste de compra', unit: 'EUR', better: 'lower', description: 'Coste unitario en origen, antes de envio e impuestos.' },
  competition: { label: 'Competencia', unit: 'anuncios', better: 'lower', description: 'Numero de ofertas comparables encontradas.' },
  salesVolume: { label: 'Ventas observadas', unit: 'unidades', better: 'higher', description: 'Volumen de ventas declarado por los propios vendedores.' },
  rating: { label: 'Valoracion media', unit: 'estrellas', better: 'higher', description: 'Valoracion media de las ofertas comparables.' },
  leadTime: { label: 'Plazo de entrega', unit: 'dias', better: 'lower', description: 'Dias declarados hasta la entrega.' },
};

export const metricDefinition = (metric) =>
  METRICS[metric] ?? { label: metric, unit: '', better: 'neutral', description: '' };

/** Redondea a dos decimales sin arrastrar ruido de coma flotante. */
export const round2 = (value) => Math.round(value * 100) / 100;

/**
 * Crea una señal parcial.
 *
 * @param {object} data
 * @param {string} data.keyword Termino o producto al que se refiere.
 * @param {keyof METRICS|string} data.metric
 * @param {number} data.value
 * @param {number} [data.confidence] 0-1. Fuentes publicas agregadas: baja por defecto.
 * @param {object} [data.evidence] De donde sale exactamente: url, muestra, nota...
 * @param {string} [data.unit] Solo si la metrica no esta en el catalogo.
 */
export const createSignal = ({ keyword, metric, value, confidence = 0.5, evidence = {}, unit }) => {
  const definition = metricDefinition(metric);

  return {
    keyword,
    metric,
    metricLabel: definition.label,
    value: typeof value === 'number' ? round2(value) : value,
    unit: unit ?? definition.unit,
    better: definition.better,
    confidence,
    evidence,
  };
};

/** Media de una lista, o `null` si no hay datos (nunca 0 por defecto). */
export const mean = (values) => {
  const clean = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (clean.length === 0) return null;
  return clean.reduce((total, value) => total + value, 0) / clean.length;
};

/** Mediana: mas robusta que la media con precios dispersos. */
export const median = (values) => {
  const clean = values.filter((value) => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) return null;

  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[middle - 1] + clean[middle]) / 2 : clean[middle];
};
