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

/** Busca el producto de la demo que mejor encaja con el termino consultado. */
export const matchProduct = (keyword) => {
  const needle = keyword.trim().toLocaleLowerCase('es');

  return (
    products.find((product) => product.name.toLocaleLowerCase('es').includes(needle)) ??
    products.find((product) => product.tags.some((tag) => needle.includes(tag))) ??
    products.find((product) => product.category.toLocaleLowerCase('es').includes(needle)) ??
    null
  );
};

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
