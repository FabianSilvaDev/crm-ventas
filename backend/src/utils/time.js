/** Utilidades de fechas e identificadores. */

const BASE_DATE = Date.UTC(2026, 9, 6, 7, 30, 0); // 2026-10-06T07:30:00Z, referencia de la demo

/**
 * Fecha de referencia de los datos simulados. Los mocks se generan en relacion a
 * esta fecha (no a la fecha real) para que las cifras no cambien entre arranques,
 * y la API la publica en `meta` para que la interfaz pueda etiquetarla.
 */
export const DEMO_REFERENCE_DATE = new Date(BASE_DATE).toISOString();

export const DEMO_REFERENCE_MS = BASE_DATE;

/** Milisegundos de un dia, usado por las series temporales del dashboard. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Fecha ISO desplazada N minutos respecto a la referencia de la demo. */
export const isoMinutesAgo = (minutes) => new Date(BASE_DATE + minutes * 60_000).toISOString();

/** Fecha ISO desplazada N dias respecto a la referencia de la demo. */
export const isoDaysAgo = (days) => isoMinutesAgo(-days * 24 * 60);

export const isoDaysFromNow = (days) => isoMinutesAgo(days * 24 * 60);

export const nowIso = () => new Date().toISOString();

/** Identificador estable con prefijo y relleno numerico: `led-0007`. */
export const makeId = (prefix, index, pad = 4) =>
  `${prefix}-${String(index).padStart(pad, '0')}`;

/** Identificador corto aleatorio-ish para ejecuciones y tareas. */
export const shortId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export const minutesBetween = (fromIso, toIso) =>
  Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60_000));

/** Formatea milisegundos como `1m 24s` / `42s`. */
export const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
};
