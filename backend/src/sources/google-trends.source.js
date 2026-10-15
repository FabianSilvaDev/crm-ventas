/**
 * Fuente: Google Trends (demanda publica).
 *
 * Usa los endpoints publicos que sirve la propia web de Trends. Es importante saber
 * lo que esto es y lo que no:
 *
 *  - `/trends/api/autocomplete/{termino}` responde bien y sirve para resolver un
 *    termino a su tema de Trends (los identificadores `/g/...` y `/m/...`).
 *  - `/trends/api/explore` + `/trends/api/widgetdata/multiline` son los que dan la
 *    serie de interes. Google **limita con dureza las IP de servidor** (responde
 *    429), asi que desde un VPS puede fallar de forma intermitente. Este adaptador
 *    lo trata como un fallo recuperable y lo dice: nunca devuelve una cifra
 *    inventada para tapar el hueco.
 *  - Requiere User-Agent de navegador: sin el, responde 404.
 *
 * Para uso intensivo o en produccion, la alternativa solida es un proveedor de pago
 * (por ejemplo SerpApi): el contrato de este modulo hace que sea un fichero mas, sin
 * tocar el resto del sistema.
 */
import { BROWSER_HEADERS, SourceError, fetchFrom, withQuery } from './http.js';
import { createSignal, mean } from './signal.js';

export const id = 'google-trends';

const BASE = 'https://trends.google.com/trends/api';
const RSS_BASE = 'https://trends.google.com/trending/rss';

/** Decodifica las entidades XML que aparecen en los titulos del feed. */
const decodeEntities = (text) =>
  text
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const tagValue = (xml, tag) => {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? decodeEntities(match[1]) : null;
};

const allTags = (xml, tag) =>
  [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((match) => decodeEntities(match[1]));

/** "500+" -> 500. Devuelve `null` si no hay cifra reconocible. */
export const parseTraffic = (value) => {
  if (!value) return null;
  const digits = String(value).replace(/[^0-9]/g, '');
  return digits === '' ? null : Number(digits);
};

/**
 * Tendencias del dia (feed RSS).
 *
 * Es el endpoint de Trends mas estable: responde siempre y no le afecta el limite de
 * peticiones que bloquea la serie de interes. A cambio hay que saber lo que trae: son
 * las busquedas que suben HOY en ese pais, y estan dominadas por actualidad y
 * deportes. Para producto su utilidad es baja, y por eso el resultado lo declara en
 * lugar de presentar ruido como si fuera demanda comercial.
 */
export const fetchTrending = async ({ geo = 'ES', timeoutMs = 8000 } = {}) => {
  const xml = await fetchFrom(id, withQuery(RSS_BASE, { geo }), {
    headers: { ...BROWSER_HEADERS, Accept: 'application/rss+xml, application/xml' },
    timeoutMs,
    parse: 'text',
  });

  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => {
    const item = match[1];
    const traffic = tagValue(item, 'ht:approx_traffic');

    return {
      title: tagValue(item, 'title'),
      traffic,
      trafficValue: parseTraffic(traffic),
      publishedAt: tagValue(item, 'pubDate'),
      newsSource: tagValue(item, 'ht:picture_source'),
      newsTitles: allTags(item, 'ht:news_item_title').slice(0, 3),
    };
  });
};

/** Resuelve un termino a temas de Trends. Es la llamada mas fiable del servicio. */
export const resolveTopics = async (keyword, { hl = 'es', timeoutMs = 8000 } = {}) => {
  const url = withQuery(`${BASE}/autocomplete/${encodeURIComponent(keyword)}`, { hl });
  const payload = await fetchFrom(id, url, { headers: BROWSER_HEADERS, timeoutMs, retries: 1 });
  const topics = payload?.default?.topics ?? [];

  return topics.slice(0, 5).map((topic) => ({
    mid: topic.mid,
    title: topic.title,
    type: topic.type ?? null,
    // Coincidencia exacta del termino buscado: la unica que se puede usar sin revisar.
    exact: typeof topic.title === 'string' && topic.title.toLocaleLowerCase('es') === keyword.toLocaleLowerCase('es'),
  }));
};

/** Serie de interes a lo largo del tiempo. Dos llamadas: explorar y leer el widget. */
export const fetchInterest = async (keyword, { geo = 'ES', timeframe = 'today 12-m', hl = 'es', tz = '-60', timeoutMs = 8000 } = {}) => {
  const request = JSON.stringify({
    comparisonItem: [{ keyword, geo, time: timeframe }],
    category: 0,
    property: '',
  });

  const explore = await fetchFrom(id, withQuery(`${BASE}/explore`, { hl, tz, req: request }), {
    headers: BROWSER_HEADERS,
    timeoutMs,
  });

  const timeseries = explore?.widgets?.find((widget) => widget.id === 'TIMESERIES');
  if (!timeseries) {
    throw new SourceError(id, 'Trends no ha devuelto una serie para ese termino.', { retryable: false });
  }

  const widgetRequest = JSON.stringify(timeseries.request);
  const data = await fetchFrom(
    id,
    withQuery(`${BASE}/widgetdata/multiline`, { hl, tz, req: widgetRequest, token: timeseries.token }),
    { headers: BROWSER_HEADERS, timeoutMs },
  );

  const points = (data?.default?.timelineData ?? []).map((point) => ({
    at: point.formattedTime ?? point.time,
    value: Array.isArray(point.value) ? point.value[0] : null,
  }));

  return { points, geo, timeframe, keyword };
};

/** Variacion porcentual del ultimo tramo frente al anterior. `null` si no hay datos. */
export const momentumFrom = (points, segment = 3) => {
  const values = points.map((point) => point.value).filter((value) => typeof value === 'number');
  if (values.length < segment * 2) return null;

  const recent = mean(values.slice(-segment));
  const previous = mean(values.slice(-segment * 2, -segment));
  if (recent === null || previous === null || previous === 0) return null;

  return ((recent - previous) / previous) * 100;
};

/**
 * Recoge señales de demanda para una lista de terminos.
 *
 * Devuelve `{ signals, notes }`. Las notas documentan lo que no se pudo obtener y por
 * que: la ausencia de un dato tambien es informacion para quien decide.
 */
export const collect = async ({ keywords = [], geo = 'ES', timeframe = 'today 12-m', timeoutMs = 8000 } = {}) => {
  const signals = [];
  const notes = [];

  for (const keyword of keywords) {
    let topics = [];

    try {
      topics = await resolveTopics(keyword, { timeoutMs });
      if (topics.length > 0) {
        // Que Trends resuelva el termino a un tema es informacion util por si sola:
        // confirma que el termino existe como tema y da el identificador con el que
        // se consultaria su serie. Se anota siempre, aunque la serie falle despues.
        const exact = topics.find((topic) => topic.exact);
        notes.push({
          level: 'info',
          message: exact
            ? `Trends resuelve "${keyword}" a "${exact.title}".`
            : `Trends resuelve "${keyword}" a ${topics.length} temas, sin coincidencia exacta de nombre.`,
          topics,
        });
      }
    } catch (error) {
      notes.push({ level: 'warning', message: `No se pudieron resolver temas para "${keyword}": ${error.message}` });
    }

    try {
      const { points } = await fetchInterest(keyword, { geo, timeframe, timeoutMs });
      const average = mean(points.map((point) => point.value));
      const momentum = momentumFrom(points);

      if (average !== null) {
        signals.push(
          createSignal({
            keyword,
            metric: 'demand',
            value: average,
            confidence: 0.55,
            evidence: {
              note: `Interes relativo medio en ${geo}, ventana "${timeframe}" (${points.length} puntos).`,
              source: 'Google Trends · interes a lo largo del tiempo',
              topics,
            },
          }),
        );
      }

      if (momentum !== null) {
        signals.push(
          createSignal({
            keyword,
            metric: 'momentum',
            value: momentum,
            confidence: 0.5,
            evidence: {
              note: 'Ultimos tres puntos frente a los tres anteriores de la misma serie.',
              source: 'Google Trends · interes a lo largo del tiempo',
            },
          }),
        );
      }
    } catch (error) {
      // Un 429 de Google no invalida el resto de la recogida: se anota y se sigue.
      notes.push({
        level: error instanceof SourceError && error.status === 429 ? 'warning' : 'error',
        message: `Sin serie de interes para "${keyword}": ${error.message}`,
        hint: error instanceof SourceError ? error.hint : undefined,
      });
    }
  }

  return { signals, notes };
};

/** Estado de la fuente: si tiene lo que necesita para funcionar. */
export const describe = () => ({
  id,
  name: 'Google Trends',
  kind: 'public',
  capabilities: ['demand', 'momentum', 'discovery'],
  requiresCredentials: false,
  docsUrl: 'https://trends.google.com/',
  limitations:
    'Endpoints publicos no documentados. Google limita las IP de servidor (429) y el endpoint de series puede fallar de forma intermitente; para uso intensivo conviene un proveedor de pago. El feed de tendencias del dia si responde, pero su contenido es de actualidad, no de producto.',
});
