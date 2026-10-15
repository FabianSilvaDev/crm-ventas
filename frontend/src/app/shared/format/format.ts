/**
 * Formato de cifras y fechas en espanol.
 *
 * Funciones puras compartidas por las tuberías (`pipes`) y por los componentes de
 * graficos, para que un mismo valor se lea igual en una tabla y en una etiqueta.
 */

const numberFormat = (value: number, decimals: number) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

/** Cifra con separador de miles espanol. */
export const formatNumber = (value: number | null | undefined, decimals = 0): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return numberFormat(value, decimals);
};

/** Importe en euros. */
export const formatEuro = (value: number | null | undefined, decimals = 0): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${numberFormat(value, decimals)} €`;
};

/** Proporcion (0-1) como porcentaje. */
export const formatPercent = (value: number | null | undefined, decimals = 1): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${numberFormat(value * 100, decimals)}%`;
};

/** Cifra abreviada para ejes y etiquetas compactas: 486,2 mil / 1,4 M. */
export const formatCompact = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000) return `${numberFormat(value / 1_000_000, 1)} M`;
  if (absolute >= 1_000) return `${numberFormat(value / 1_000, 1)} mil`;
  return numberFormat(value, 0);
};

/** Duracion en milisegundos: `1m 24s`, `42s`, `820 ms`. */
export const formatDuration = (ms: number | null | undefined): string => {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
};

/** Minutos como duracion legible: `9 min`, `1 h 20 min`. */
export const formatMinutes = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${Math.round(minutes % 60)} min`;
};

const RELATIVE_STEPS: { limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60_000, divisor: 1000, unit: 'second' },
  { limit: 3_600_000, divisor: 60_000, unit: 'minute' },
  { limit: 86_400_000, divisor: 3_600_000, unit: 'hour' },
  { limit: 2_592_000_000, divisor: 86_400_000, unit: 'day' },
  { limit: 31_536_000_000, divisor: 2_592_000_000, unit: 'month' },
];

/**
 * Tiempo relativo respecto a una referencia (`ahora` por defecto).
 * La referencia es parametrizable porque los datos de la demo son historicos y se
 * comparan contra la fecha de referencia que publica la API.
 */
export const formatTimeAgo = (iso: string | null | undefined, reference?: string | Date): string => {
  if (!iso) return '—';

  const target = new Date(iso).getTime();
  const base = reference ? new Date(reference).getTime() : Date.now();
  if (Number.isNaN(target) || Number.isNaN(base)) return '—';

  const diff = base - target;
  const formatter = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' });

  for (const step of RELATIVE_STEPS) {
    if (Math.abs(diff) < step.limit) {
      return formatter.format(-Math.round(diff / step.divisor), step.unit);
    }
  }

  return formatter.format(-Math.round(diff / 31_536_000_000), 'year');
};

/** Fecha y hora cortas en espanol. */
export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
};

/** Solo la fecha, sin hora. */
export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

/** Redondea al alza hasta un valor "redondo" para los ejes de un grafico. */
export const niceCeiling = (value: number): number => {
  if (value <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return step * magnitude;
};
