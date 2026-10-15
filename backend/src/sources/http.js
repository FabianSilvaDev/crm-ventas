/**
 * Cliente HTTP para las fuentes externas.
 *
 * Toda llamada a un tercero pasa por aqui: timeouts, una sola politica de errores y
 * un error tipado que dice QUE fuente fallo y si merece la pena reintentar. Ninguna
 * fuente puede dejar caer la peticion del usuario ni colgar el servidor.
 */

/** Error de una fuente externa, con el contexto que necesita quien lo muestra. */
export class SourceError extends Error {
  /**
   * @param {string} sourceId Identificador de la fuente (`google-trends`, ...).
   * @param {string} message Mensaje apto para el usuario.
   * @param {object} [options]
   * @param {number} [options.status] Codigo HTTP recibido, si lo hubo.
   * @param {boolean} [options.retryable] Si tiene sentido reintentar mas tarde.
   * @param {string} [options.hint] Que puede hacer el operador al respecto.
   */
  constructor(sourceId, message, { status, retryable = false, hint } = {}) {
    super(message);
    this.name = 'SourceError';
    this.sourceId = sourceId;
    this.status = status;
    this.retryable = retryable;
    this.hint = hint;
  }
}

/**
 * Cabeceras de navegador.
 * Google Trends devuelve 404 a peticiones sin User-Agent de navegador; no es
 * evasion, es que su endpoint publico solo responde a clientes web.
 */
export const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

/** Quita el prefijo anti-XSSI que devuelven algunos endpoints de Google. */
const stripXssiPrefix = (text) => text.replace(/^\)\]\}',?\s*/, '');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Peticion HTTP con timeout, reintentos y error tipado.
 *
 * @param {string} sourceId Fuente que realiza la llamada (para el error).
 * @param {string} url
 * @param {object} [options]
 * @param {Record<string,string>} [options.headers]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.retries] Reintentos ante error de red o 5xx.
 * @param {'json'|'text'} [options.parse]
 * @returns {Promise<any>}
 */
export const fetchFrom = async (sourceId, url, options = {}) => {
  const { headers = {}, timeoutMs = 8000, retries = 1, parse = 'json' } = options;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      const text = await response.text();

      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429;
        throw new SourceError(sourceId, `La fuente respondio ${response.status}.`, {
          status: response.status,
          retryable,
          hint:
            response.status === 429
              ? 'La fuente esta limitando las peticiones; suele ser cosa de la IP del servidor. Reintenta mas tarde o usa un proveedor de pago.'
              : undefined,
        });
      }

      if (parse === 'text') return text;

      try {
        return JSON.parse(stripXssiPrefix(text));
      } catch {
        throw new SourceError(sourceId, 'La fuente devolvio una respuesta que no es JSON valido.');
      }
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      lastError = isAbort
        ? new SourceError(sourceId, `La fuente no respondio en ${timeoutMs} ms.`, { retryable: true })
        : error instanceof SourceError
          ? error
          : new SourceError(sourceId, `No se pudo contactar con la fuente: ${error.cause?.code ?? error.message}`, {
              retryable: true,
            });
    } finally {
      clearTimeout(timer);
    }

    // Solo se reintenta lo que puede mejorar: errores de red, timeouts, 5xx y 429.
    const shouldRetry = lastError instanceof SourceError && lastError.retryable && attempt < retries;
    if (!shouldRetry) break;
    await sleep(400 * (attempt + 1));
  }

  throw lastError;
};

/** Construye una URL con parametros, descartando los vacios. */
export const withQuery = (base, params = {}) => {
  const url = new URL(base);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
};
