/**
 * Registro de fuentes de datos del estudio de oportunidad.
 *
 * Es el unico punto por el que el sistema habla con el exterior. Sus dos reglas:
 *
 *  1. **Ninguna señal sale sin procedencia.** Los adaptadores devuelven señales
 *     parciales y es aqui donde se les sella la fuente, el modo (`live` o
 *     `simulated`) y la fecha de recogida.
 *  2. **Un fallo de una fuente no tumba la recogida.** Cada adaptador se ejecuta por
 *     separado, con su propio estado; si Google limita las peticiones o faltan las
 *     credenciales de AliExpress, el informe lo dice y el resto sigue.
 *
 * Anadir una fuente nueva (por ejemplo un CSV de proveedor o un proveedor de pago para
 * Trends) es anadir un adaptador con `collect()` y registrarlo en `adapters()`.
 */
import { config } from '../config.js';
import { nowIso } from '../utils/time.js';
import * as alibabaGroup from './alibaba-group.source.js';
import * as trends from './google-trends.source.js';
import * as simulated from './simulated.source.js';

/** Metadatos de procedencia que se sellan en cada señal. */
const meta = (sourceId, name, kind, mode) => ({ id: sourceId, name, kind, mode });

const configured = (profile) => Boolean(profile.appKey && profile.appSecret);

/** Adaptadores reales, en el orden en que se intentan. */
const liveAdapters = () => {
  const profiles = alibabaGroup.profiles(config);

  return [
    {
      meta: meta('google-trends', 'Google Trends', 'public', 'live'),
      available: true,
      run: (options) =>
        trends.collect({ keywords: options.keywords, geo: options.geo, timeframe: options.timeframe, timeoutMs: config.sources.timeoutMs }),
    },
    {
      meta: meta('aliexpress', 'AliExpress', 'marketplace', 'live'),
      available: configured(profiles.aliexpress),
      unavailableReason: 'Faltan ALIEXPRESS_APP_KEY y ALIEXPRESS_APP_SECRET.',
      run: (options) => alibabaGroup.collect({ keywords: options.keywords, profile: profiles.aliexpress }),
    },
    {
      meta: meta('alibaba', 'Alibaba.com', 'marketplace', 'live'),
      available: configured(profiles.alibaba),
      unavailableReason: 'Faltan ALIBABA_APP_KEY y ALIBABA_APP_SECRET.',
      run: (options) => alibabaGroup.collect({ keywords: options.keywords, profile: profiles.alibaba }),
    },
  ];
};

const simulatedAdapter = () => ({
  meta: meta('simulated', 'Datos de demostracion', 'simulated', 'simulated'),
  available: true,
  run: (options) => simulated.collect({ keywords: options.keywords }),
});

/**
 * Descubrimiento: terminos que estan subiendo ahora mismo en un pais.
 *
 * Sirve para que Yanca proponga temas en lugar de esperar a que el operador los
 * adivine. Con una advertencia que devuelve la propia respuesta: el feed de
 * tendencias del dia son las busquedas que suben HOY, y estan dominadas por
 * actualidad y deportes, asi que para producto su utilidad es limitada.
 */
export const discoverRisingTerms = async ({ geo = config.trends.geo, limit = 10 } = {}) => {
  const collectedAt = nowIso();

  try {
    const terms = await trends.fetchTrending({ geo, timeoutMs: config.sources.timeoutMs });

    return {
      geo,
      collectedAt,
      source: meta('google-trends', 'Google Trends', 'public', 'live'),
      terms: terms.slice(0, limit),
      caveat:
        'El feed de tendencias del dia recoge lo que sube hoy: su contenido es de actualidad, no de demanda comercial. Usalo como contexto y como fuente de terminos, no como validacion de producto.',
      error: null,
    };
  } catch (error) {
    return {
      geo,
      collectedAt,
      source: meta('google-trends', 'Google Trends', 'public', 'live'),
      terms: [],
      caveat: null,
      error: { message: error.message, hint: error.hint ?? null },
    };
  }
};

/** Sella la procedencia en las señales que devuelve un adaptador. */
const stamp = (signals, sourceMeta, collectedAt) =>
  signals.map((signal) => ({ ...signal, source: sourceMeta, collectedAt }));

/**
 * Lista de fuentes con su estado real: que capacidades aporta cada una, si esta
 * configurada y por que no lo esta cuando es el caso.
 */
export const listSources = () => {
  const profiles = alibabaGroup.profiles(config);
  const alibabaDescriptor = alibabaGroup.describe(config);

  return [
    { ...trends.describe(), mode: 'live', available: true },
    {
      id: 'aliexpress',
      name: 'AliExpress',
      kind: 'marketplace',
      capabilities: ['cost', 'price', 'competition', 'salesVolume'],
      requiresCredentials: true,
      docsUrl: 'https://openservice.aliexpress.com/',
      limitations: alibabaDescriptor.limitations,
      available: configured(profiles.aliexpress),
      method: profiles.aliexpress.searchMethod,
      role: profiles.aliexpress.role,
      unavailableReason: configured(profiles.aliexpress) ? null : 'Faltan ALIEXPRESS_APP_KEY y ALIEXPRESS_APP_SECRET.',
      setupHint: profiles.aliexpress.credentialHint,
      mode: 'live',
    },
    {
      id: 'alibaba',
      name: 'Alibaba.com',
      kind: 'marketplace',
      capabilities: ['cost', 'competition', 'salesVolume'],
      requiresCredentials: true,
      docsUrl: 'https://open.alibaba.com/',
      limitations: alibabaDescriptor.limitations,
      available: configured(profiles.alibaba),
      method: profiles.alibaba.searchMethod,
      role: 'buyer',
      unavailableReason: configured(profiles.alibaba) ? null : 'Faltan ALIBABA_APP_KEY y ALIBABA_APP_SECRET.',
      setupHint: profiles.alibaba.credentialHint,
      mode: 'live',
    },
    { ...simulated.describe(), mode: 'simulated', available: Boolean(config.sources.mode !== 'live') },
  ];
};

/**
 * Recoge señales de todas las fuentes disponibles.
 *
 * @param {object} options
 * @param {string[]} options.keywords Terminos a estudiar.
 * @param {string} [options.geo]
 * @param {string} [options.timeframe]
 * @param {'auto'|'live'|'simulated'} [options.mode] `auto`/`live`: solo fuentes reales,
 *   sin relleno. `simulated`: datos de demostracion, solo si se piden expresamente.
 * @returns {Promise<{signals: object[], notes: object[], sources: object[], collectedAt: string}>}
 */
export const collectSignals = async ({ keywords = [], geo, timeframe, mode = config.sources.mode } = {}) => {
  const collectedAt = nowIso();
  const notes = [];
  const sources = [];
  const signals = [];

  const adapters = mode === 'simulated' ? [] : liveAdapters();

  for (const adapter of adapters) {
    if (!adapter.available) {
      sources.push({
        id: adapter.meta.id,
        name: adapter.meta.name,
        mode: 'unavailable',
        signals: 0,
        reason: adapter.unavailableReason,
      });
      continue;
    }

    const startedAt = Date.now();
    try {
      const result = await adapter.run({ keywords, geo, timeframe });
      const stamped = stamp(result.signals, adapter.meta, collectedAt);

      signals.push(...stamped);
      notes.push(...result.notes);
      sources.push({
        id: adapter.meta.id,
        name: adapter.meta.name,
        mode: 'live',
        signals: stamped.length,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      sources.push({
        id: adapter.meta.id,
        name: adapter.meta.name,
        mode: 'error',
        signals: 0,
        durationMs: Date.now() - startedAt,
        reason: error.message,
        hint: error.hint,
      });
      notes.push({ level: 'error', message: `${adapter.meta.name}: ${error.message}`, hint: error.hint });
    }
  }

  // Los datos de demostracion **solo** se usan si el operador los pide expresamente
  // (`mode: 'simulated'`). En `auto` y `live` no se rellena ningun hueco: si una fuente no
  // aporta un dato, no hay dato. Inventar una cifra para que la vista no quede vacia es
  // exactamente lo que no debe hacer un sistema de decision.
  if (mode === 'simulated') {
    const adapter = simulatedAdapter();
    const result = await adapter.run({ keywords });
    const stamped = stamp(result.signals, adapter.meta, collectedAt);

    signals.push(...stamped);
    notes.push(...result.notes);
    sources.push({ id: adapter.meta.id, name: adapter.meta.name, mode: 'simulated', signals: stamped.length });
  }

  return { signals, notes, sources, collectedAt, mode };
};
