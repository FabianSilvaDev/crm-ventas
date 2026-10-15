/**
 * Configuracion central del backend.
 * Todos los valores tienen un default razonable para que el proyecto arranque
 * sin necesidad de crear un .env (ver .env.example).
 */
import process from 'node:process';

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const list = (value, fallback) =>
  (value ?? fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const config = {
  port: num(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiPrefix: '/api/v1',
  version: '1.0.0',
  /** Marca todas las respuestas: los datos son ficticios (seccion 11 del prompt). */
  demo: true,
  corsOrigins: list(process.env.CORS_ORIGINS, 'http://localhost:4200,http://127.0.0.1:4200'),
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    /** En tests se silencia el log para no ensuciar la salida de `node --test`. */
    enabled: process.env.NODE_ENV !== 'test',
  },
  simulation: {
    /** Duracion de cada etapa de un flujo simulado. */
    stepMs: clamp(num(process.env.SIMULATION_STEP_MS, 4200), 200, 120000),
    /** Duracion del calculo simulado de una tarea suelta de agente. */
    taskMs: clamp(num(process.env.SIMULATION_TASK_MS, 2600), 200, 120000),
    /** Probabilidad de error controlado por etapa (0-1). 0 desactiva los fallos. */
    failureRate: clamp(num(process.env.SIMULATION_FAILURE_RATE, 0.03), 0, 1),
    /** Cadencia del temporizador que avanza progreso y etapas. */
    tickMs: clamp(num(process.env.SIMULATION_TICK_MS, 250), 50, 5000),
    /** Limite de ejecuciones simultaneas guardadas en memoria. */
    maxRuns: clamp(num(process.env.SIMULATION_MAX_RUNS, 25), 1, 500),
    /** Limite de eventos guardados por ejecucion. */
    maxEventsPerRun: clamp(num(process.env.SIMULATION_MAX_EVENTS, 400), 10, 5000),
    /**
     * Puertas de decision dentro del flujo.
     * Con `true` (por defecto) el flujo se detiene en validacion, presupuesto y
     * publicacion y espera la decision del operador. Con `false` recorre el ciclo del
     * tiron, util para demostraciones desatendidas.
     */
    gates: !['off', 'false', '0', 'no'].includes(String(process.env.SIMULATION_GATES ?? 'on').toLowerCase()),
    /** Margen minimo por defecto exigido al validar una oportunidad (0-1). */
    defaultMinMargin: clamp(num(process.env.DEFAULT_MIN_MARGIN, 0.3), 0, 1),
  },
  /** Intervalo de polling sugerido, que la API anuncia al frontend en cada respuesta. */
  pollIntervalMs: clamp(num(process.env.POLL_INTERVAL_MS, 1500), 250, 30000),
  /** Paginacion por defecto de los listados. */
  pagination: {
    defaultPageSize: 25,
    maxPageSize: 200,
  },
  /** Limitador de peticiones muy simple, en memoria. */
  rateLimit: {
    windowMs: clamp(num(process.env.RATE_LIMIT_WINDOW_MS, 60000), 1000, 600000),
    max: clamp(num(process.env.RATE_LIMIT_MAX, 600), 10, 100000),
  },
  /**
   * Fuentes externas de datos para el estudio de oportunidad.
   *
   * `mode` decide que se puede usar:
   *  - `auto`      usa las fuentes reales disponibles y, si ninguna responde o esta
   *                configurada, completa con datos simulados marcados como tales.
   *  - `live`      solo fuentes reales: si no hay ninguna, no devuelve datos.
   *  - `simulated` no sale a la red; trabaja solo con datos de demostracion.
   */
  sources: {
    mode: ['auto', 'live', 'simulated'].includes(process.env.SOURCES_MODE)
      ? process.env.SOURCES_MODE
      : 'auto',
    timeoutMs: clamp(num(process.env.SOURCES_TIMEOUT_MS, 8000), 1000, 60000),
    /** Resultados por consulta en las plataformas de origen. */
    pageSize: clamp(num(process.env.SOURCES_PAGE_SIZE, 20), 1, 50),
  },
  trends: {
    geo: process.env.TRENDS_GEO ?? 'ES',
    timeframe: process.env.TRENDS_TIMEFRAME ?? 'today 12-m',
    hl: process.env.TRENDS_HL ?? 'es',
    tz: process.env.TRENDS_TZ ?? '-60',
  },
  aliexpress: {
    appKey: process.env.ALIEXPRESS_APP_KEY ?? '',
    appSecret: process.env.ALIEXPRESS_APP_SECRET ?? '',
    trackingId: process.env.ALIEXPRESS_TRACKING_ID ?? '',
    apiBase: process.env.ALIEXPRESS_API_BASE ?? 'https://api-sg.aliexpress.com/sync',
    searchMethod: process.env.ALIEXPRESS_SEARCH_METHOD ?? 'aliexpress.affiliate.product.query',
    currency: process.env.ALIEXPRESS_CURRENCY ?? 'EUR',
    /** `buyer` cuando se compra ahi para revender (el precio observado es COSTE). */
    role: process.env.ALIEXPRESS_ROLE === 'seller' ? 'seller' : 'buyer',
  },
  alibaba: {
    appKey: process.env.ALIBABA_APP_KEY ?? '',
    appSecret: process.env.ALIBABA_APP_SECRET ?? '',
    apiBase: process.env.ALIBABA_API_BASE ?? 'https://openapi-api.alibaba.com/rest',
    /** El nombre exacto depende de la app aprobada: confirmalo en tu Open Platform. */
    searchMethod: process.env.ALIBABA_SEARCH_METHOD ?? 'alibaba.icbu.product.search',
  },
};
