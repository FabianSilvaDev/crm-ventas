/**
 * Contratos genericos de la API.
 * Todas las respuestas del backend envuelven los datos en `{ data, meta }`; los
 * errores en `{ error, meta }`.
 */

export interface ApiMeta {
  generatedAt: string;
  apiVersion: string;
  demo: boolean;
  demoReferenceDate: string;
  pollIntervalMs: number;
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  note?: string;
  [key: string]: unknown;
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
  meta: ApiMeta;
}

/** Error normalizado que consumen los componentes. */
export interface NormalizedApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  /** `true` cuando el fallo es de red o el backend no responde. */
  offline: boolean;
}

/** Filtros de paginacion aceptados por los listados. */
export interface PageQuery {
  page?: number;
  pageSize?: number;
}

/** Claves admitidas por el orden de la oficina virtual. */
export type AccentKey =
  | 'amber'
  | 'cyan'
  | 'violet'
  | 'pink'
  | 'green'
  | 'orange'
  | 'lime'
  | 'blue';

/** Severidad usada en actividad, senales y avisos. */
export type Severity = 'info' | 'success' | 'warning' | 'error';

/** Metrica simple clave/valor devuelta por los resultados simulados. */
export interface Metric {
  label: string;
  value: string;
}

/** Referencia a un recurso relacionado, usada por la actividad y los artefactos. */
export interface ResourceRef {
  type: string;
  id: string;
  label: string | null;
}
