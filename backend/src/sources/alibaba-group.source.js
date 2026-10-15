/**
 * Fuente: AliExpress y Alibaba (plataformas de origen).
 *
 * Ambas usan el mismo esquema de firma de Alibaba (TOP): los parametros ordenados por
 * nombre, concatenados como `clavevalor`, envueltos por el secreto y firmados con MD5
 * en mayusculas. Se implementan como UN adaptador con dos perfiles, porque comparten
 * transporte, firma y forma de error.
 *
 * Requiere credenciales de la Open Platform de cada plataforma (app key y secret, con
 * la aplicacion aprobada). Sin ellas la fuente queda `unavailable` y lo dice: no hay
 * datos de relleno.
 *
 * OJO con el significado del precio: en AliExpress, `target_sale_price` es el precio
 * al que se vende ahi. Para quien COMPRA en AliExpress para revender, ese precio es su
 * COSTE; para quien VENDE alli, es su precio de venta. El perfil lo declara con
 * `role` y el adaptador etiqueta la señal en consecuencia.
 */
import { createHash } from 'node:crypto';
import { SourceError, fetchFrom, withQuery } from './http.js';
import { createSignal, median, round2 } from './signal.js';

export const id = 'alibaba-group';

/** Firma TOP: md5(secreto + claves ordenadas concatenadas + secreto), en mayusculas. */
export const signTopMd5 = (params, secret) => {
  const sorted = Object.keys(params)
    .filter((key) => key !== 'sign' && params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort();

  const concatenated = sorted.map((key) => `${key}${params[key]}`).join('');
  return createHash('md5').update(`${secret}${concatenated}${secret}`, 'utf8').digest('hex').toUpperCase();
};

/** Convierte a numero lo que la API devuelve como cadena; `null` si no es valido. */
const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(String(value).replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Llamada firmada a la Open Platform.
 *
 * @param {object} profile Perfil de la plataforma (ver `describe`).
 * @param {string} method Metodo de la API (`aliexpress.affiliate.product.query`...).
 * @param {Record<string, unknown>} businessParametros Parametros de negocio.
 */
export const call = async (profile, method, businessParams = {}) => {
  if (!profile.appKey || !profile.appSecret) {
    throw new SourceError(id, 'Faltan las credenciales de la plataforma.', {
      hint: 'Configura ALIEXPRESS_APP_KEY/ALIEXPRESS_APP_SECRET (o ALIBABA_*) con una app aprobada en su Open Platform.',
    });
  }

  const system = {
    app_key: profile.appKey,
    method,
    timestamp: String(Date.now()),
    sign_method: 'md5',
    format: 'json',
    v: '2.0',
    ...(profile.trackingId ? { tracking_id: profile.trackingId } : {}),
  };

  const params = { ...system, ...businessParams };
  const signed = { ...params, sign: signTopMd5(params, profile.appSecret) };

  // En Alibaba ICBU el metodo va en la ruta; en el endpoint sync, como parametro.
  const url = profile.methodInPath
    ? withQuery(`${profile.apiBase}/${method}`, { ...signed, method: undefined })
    : withQuery(profile.apiBase, signed);

  const payload = await fetchFrom(id, url, { timeoutMs: profile.timeoutMs });

  // Error de negocio de la plataforma.
  const error = payload?.error_response ?? (payload?.code && payload?.message ? payload : null);
  if (error) {
    throw new SourceError(id, `${profile.name} respondio ${error.code}: ${error.msg ?? error.message}`, {
      retryable: error.code === 'Throttling' || String(error.code).includes('Limit'),
      hint:
        error.code === 'InvalidAppKey' || error.code === 'InvalidSignature'
          ? 'Comprueba las credenciales y que la aplicacion este aprobada en la Open Platform.'
          : undefined,
    });
  }

  return payload;
};

/** Extrae la lista de productos y el total de resultados de una respuesta de busqueda. */
export const extractProducts = (payload) => {
  const body =
    payload?.aliexpress_affiliate_product_query_response?.resp_result?.result ??
    payload?.result ??
    payload?.data ??
    null;

  const products = body?.products ?? body?.product_list ?? body?.items ?? [];
  const total = toNumber(body?.total_record_count ?? body?.total_results ?? payload?.total);

  return { products: Array.isArray(products) ? products : [], total };
};

/**
 * Recoge señales de mercado para una lista de terminos.
 * @returns {Promise<{signals: object[], notes: object[]}>}
 */
export const collect = async ({ keywords = [], profile } = {}) => {
  const signals = [];
  const notes = [];

  if (!profile?.appKey || !profile?.appSecret) {
    return {
      signals,
      notes: [
        {
          level: 'warning',
          message: `${profile?.name ?? 'La plataforma'} no esta configurada: falta la clave de aplicacion.`,
          hint: profile?.credentialHint,
        },
      ],
    };
  }

  for (const keyword of keywords) {
    try {
      const payload = await call(profile, profile.searchMethod, {
        keywords: keyword,
        page_size: profile.pageSize,
        page_no: 1,
        ...profile.searchParams,
      });

      const { products, total } = extractProducts(payload);
      if (products.length === 0) {
        notes.push({ level: 'info', message: `Sin ofertas comparables para "${keyword}" en ${profile.name}.` });
        continue;
      }

      const prices = products.map((product) => toNumber(product.target_sale_price ?? product.sale_price ?? product.price));
      const volumes = products.map((product) => toNumber(product.lastest_volume ?? product.orders ?? product.sales));
      const priceMedian = median(prices);
      const evidence = {
        note: `${products.length} ofertas analizadas en ${profile.name}${total ? ` de ${total} resultados` : ''}.`,
        source: `${profile.name} · ${profile.searchMethod}`,
        sample: products.slice(0, 3).map((product) => ({
          title: product.product_title ?? product.subject ?? product.title,
          price: toNumber(product.target_sale_price ?? product.sale_price ?? product.price),
        })),
      };

      // El mismo dato significa coste o precio segun el papel declarado en el perfil.
      if (priceMedian !== null) {
        signals.push(
          createSignal({
            keyword,
            metric: profile.role === 'buyer' ? 'cost' : 'price',
            value: priceMedian,
            confidence: 0.65,
            evidence: {
              ...evidence,
              note: `${evidence.note} Precio mediano de las ofertas (${profile.role === 'buyer' ? 'coste de compra' : 'precio de venta'}).`,
            },
          }),
        );
      }

      const volume = volumes.reduce((sum, value) => (sum === null || value === null ? sum ?? value : sum + value), null);
      if (volume !== null && volume > 0) {
        signals.push(
          createSignal({
            keyword,
            metric: 'salesVolume',
            value: volume,
            confidence: 0.45,
            evidence: { ...evidence, note: `${evidence.note} Ventas declaradas por los vendedores (dato de parte).` },
          }),
        );
      }

      if (total !== null && total > 0) {
        signals.push(
          createSignal({
            keyword,
            metric: 'competition',
            value: total,
            confidence: 0.6,
            evidence: {
              ...evidence,
              note: `${total} ofertas comparables: a mas ofertas, mas competencia.`,
            },
          }),
        );
      }
    } catch (error) {
      notes.push({
        level: 'error',
        message: `No se pudo consultar "${keyword}" en ${profile.name}: ${error.message}`,
        hint: error instanceof SourceError ? error.hint : undefined,
      });
    }
  }

  return { signals, notes };
};

/** Perfiles disponibles: la misma logica, dos plataformas. */
export const profiles = (config) => ({
  aliexpress: {
    name: 'AliExpress',
    apiBase: config.aliexpress.apiBase,
    appKey: config.aliexpress.appKey,
    appSecret: config.aliexpress.appSecret,
    trackingId: config.aliexpress.trackingId,
    searchMethod: config.aliexpress.searchMethod,
    searchParams: { target_currency: config.aliexpress.currency, target_language: 'ES' },
    pageSize: config.sources.pageSize,
    methodInPath: false,
    role: config.aliexpress.role,
    timeoutMs: config.sources.timeoutMs,
    credentialHint:
      'Crea una aplicacion en la Open Platform de AliExpress (programa de afiliados o dropshipping) y pon ALIEXPRESS_APP_KEY y ALIEXPRESS_APP_SECRET en backend/.env.',
  },
  alibaba: {
    name: 'Alibaba.com',
    apiBase: config.alibaba.apiBase,
    appKey: config.alibaba.appKey,
    appSecret: config.alibaba.appSecret,
    searchMethod: config.alibaba.searchMethod,
    searchParams: {},
    pageSize: config.sources.pageSize,
    methodInPath: true,
    role: 'buyer',
    timeoutMs: config.sources.timeoutMs,
    credentialHint:
      'Solicita acceso a la Open Platform de Alibaba.com y confirma el nombre exacto del metodo de busqueda aprobado para tu app (ALIBABA_SEARCH_METHOD).',
  },
});

/** Estado de la fuente, con un perfil por plataforma. */
export const describe = (config) => {
  const available = profiles(config);

  return {
    id,
    name: 'AliExpress / Alibaba.com',
    kind: 'marketplace',
    capabilities: ['price', 'cost', 'competition', 'salesVolume'],
    requiresCredentials: true,
    docsUrl: 'https://openservice.aliexpress.com/',
    limitations:
      'Solo por API oficial: el scraping de las webs va contra sus condiciones. Los limites de peticiones dependen de la aplicacion aprobada.',
    profiles: Object.values(available).map((profile) => ({
      name: profile.name,
      configured: Boolean(profile.appKey && profile.appSecret),
      method: profile.searchMethod,
      role: profile.role,
    })),
  };
};
