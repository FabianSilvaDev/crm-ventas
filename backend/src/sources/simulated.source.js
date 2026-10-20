/**
 * Fuente: datos simulados de demostracion.
 *
 * Existe por dos razones concretas:
 *
 *  1. El proyecto tiene que funcionar sin claves de API ni red. Sin esta fuente, el
 *     estudio de oportunidad no se podria ni ver al arrancar.
 *  2. Es la prueba de que la procedencia esta bien modelada: sus señales se marcan
 *     como `simulated` y con confianza baja, de modo que es IMPOSIBLE confundir un
 *     dato de demostracion con uno real en la interfaz.
 *
 * No inventa cifras sueltas: reutiliza el catalogo de productos y los informes de
 * investigacion de la propia demo, asi que lo que devuelve es coherente con el resto
 * de la aplicacion.
 */
import { products, researchReports } from '../mocks/index.js';
import { createRandom, seedFrom } from '../utils/random.js';
import { createSignal } from './signal.js';

export const id = 'simulated';

/** Normaliza texto para comparar: minusculas, sin acentos ni signos. */
const normalize = (text) =>
  String(text ?? '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Palabras con contenido (se descartan articulos y preposiciones cortas). */
const significantWords = (text) => [...new Set(normalize(text).split(' ').filter((word) => word.length > 2))];

/**
 * Propone un producto del catalogo para un termino, y **dice en que se basa**.
 *
 * No basta con "se parece": el operador necesita distinguir entre
 *   - un producto concreto identificado (confianza alta), y
 *   - un simple ejemplo de la categoria (confianza baja), porque en ese caso elegir el
 *     producto es una decision suya, no del sistema.
 *
 * @returns {{product: object, basis: string, confidence: 'alta'|'baja', note: string}|null}
 */
export const proposeProduct = (keyword) => {
  const needle = normalize(keyword);
  if (!needle) return null;

  // 1) Coincidencia por nombre: la mas fiable.
  for (const product of products) {
    const name = normalize(product.name);
    if (name && (name.includes(needle) || needle.includes(name))) {
      return {
        product,
        basis: 'nombre del catalogo',
        confidence: 'alta',
        note: 'El termino coincide con el nombre del producto.',
      };
    }
  }

  // 2) Varias palabras del termino en el nombre del producto.
  const needleWords = significantWords(keyword);
  let best = null;

  for (const product of products) {
    const nameWords = new Set(significantWords(product.name));
    const shared = needleWords.filter((word) => nameWords.has(word));
    if (shared.length >= 2 && (!best || shared.length > best.shared)) best = { product, shared: shared.length };
  }

  if (best && needleWords.length > 0 && best.shared / needleWords.length >= 0.6) {
    return {
      product: best.product,
      basis: 'palabras en comun',
      confidence: 'alta',
      note: `Comparte ${best.shared} palabra(s) con el nombre del producto.`,
    };
  }

  // 3) Es una categoria, no un producto: se propone un ejemplo y se dice sin rodeos.
  const inCategory = products.filter((product) => {
    const category = normalize(product.category);
    return category && (needle === category || needle.startsWith(`${category} `) || needle.includes(category));
  });

  if (inCategory.length > 0) {
    const candidate = inCategory[0];
    return {
      product: candidate,
      basis: 'categoria',
      confidence: 'baja',
      note: `«${keyword}» es una categoria (${candidate.category}) con ${inCategory.length} producto(s) en el catalogo. El propuesto es solo un ejemplo: confirma cual quieres antes de aprobar.`,
    };
  }

  return null;
};

/**
 * Producto del catalogo que mejor encaja con el termino, si hay una propuesta.
 * Lo usan los datos simulados para tomar sus cifras.
 */
export const matchProduct = (keyword) => proposeProduct(keyword)?.product ?? null;

/** Numero de competidores del informe que respalda al producto, si se encontro. */
const competitorsOf = (product) => {
  if (!product) return null;
  return researchReports.find((report) => report.id === product.researchId)?.competitors?.length ?? null;
};

/**
 * Recoge señales simuladas para una lista de terminos.
 * @returns {Promise<{signals: object[], notes: object[]}>}
 */
export const collect = async ({ keywords = [] } = {}) => {
  const signals = [];
  const notes = [
    {
      level: 'info',
      message: 'Datos de demostracion: no se ha consultado ninguna fuente externa.',
      hint: 'Configura credenciales y SOURCES_MODE=live para trabajar con datos reales.',
    },
  ];

  for (const keyword of keywords) {
    const product = matchProduct(keyword);
    // Semilla estable: el mismo termino devuelve siempre las mismas cifras.
    const random = createRandom(seedFrom(`simulated-source:${keyword.toLocaleLowerCase('es')}`));

    const demand = product?.validation.demandIndex ?? random.int(35, 88);
    const cost = product?.pricing.cost ?? random.int(12, 180);
    const price = product?.pricing.price ?? Math.round(cost * (1 + random.float(0.25, 0.6, 2)));
    const competition = competitorsOf(product) ?? random.int(4, 40);
    const volume = product?.kpis.unitsSold || random.int(40, 900);

    const evidence = {
      source: product ? `Catalogo de demostracion · ${product.id}` : 'Generador simulado con semilla fija',
      note: product
        ? `Valores tomados del producto "${product.name}" del catalogo de demostracion.`
        : 'Sin coincidencia en el catalogo: valores generados de forma determinista para la demo.',
    };

    signals.push(
      createSignal({ keyword, metric: 'demand', value: demand, confidence: 0.2, evidence }),
      createSignal({ keyword, metric: 'cost', value: cost, confidence: 0.2, evidence }),
      createSignal({ keyword, metric: 'price', value: price, confidence: 0.2, evidence }),
      createSignal({ keyword, metric: 'competition', value: competition, confidence: 0.15, evidence }),
      createSignal({ keyword, metric: 'salesVolume', value: volume, confidence: 0.15, evidence }),
      createSignal({
        keyword,
        metric: 'momentum',
        value: random.float(-12, 26, 1),
        confidence: 0.15,
        evidence,
      }),
    );
  }

  return { signals, notes };
};

export const describe = () => ({
  id,
  name: 'Datos de demostracion',
  kind: 'simulated',
  capabilities: ['demand', 'momentum', 'cost', 'price', 'competition', 'salesVolume'],
  requiresCredentials: false,
  limitations: 'Cifras de ejemplo coherentes con el catalogo de la demo. No son datos de mercado.',
});
