import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';

/**
 * Contexto de petición: el hilo que une un error HTTP, los logs y (cuando existan) la fila de
 * `audit_logs` y el `ai_run`.
 *
 * Se propaga con `AsyncLocalStorage` para que ningún servicio tenga que recibir el `traceId` por
 * parámetro: `docs/api.md` §1.9 exige que el mismo valor aparezca en la respuesta, en el cuerpo
 * del error y en los logs, y hacerlo a mano garantiza que en algún sitio se olvide.
 */

/** Formato del `traceId`: 32 caracteres hexadecimales (`docs/api.md` §1.9). */
export const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/;

export interface RequestContext {
  readonly traceId: string;
  /** `X-Request-Id` del cliente, si lo envió y superó la validación. */
  readonly requestId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Genera un `traceId`.
 *
 * **Ojo:** según `docs/api.md` §1.9 el `traceId` es el hex del span raíz de OpenTelemetry, no un
 * valor aleatorio nuestro. Mientras OTel no esté cableado (no lo está en este hito), generamos
 * uno con el formato correcto para que la correlación entre respuesta, error y logs funcione ya.
 * Cuando OTel entre, **este es el único sitio que cambia**: pasa a leer el span activo.
 */
export function generateTraceId(): string {
  return randomBytes(16).toString('hex');
}

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function currentTraceId(): string | undefined {
  return storage.getStore()?.traceId;
}

/**
 * Caracteres admitidos en un `X-Request-Id` entrante.
 *
 * `X-Request-Id` lo controla el **cliente**, y se escribe en los logs. Aceptarlo tal cual es
 * inyección de logs: un valor con `\n` fabrica líneas de log falsas. Si no encaja, se descarta
 * en silencio — el `traceId` del servidor sigue siendo la correlación fiable.
 */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function sanitizeRequestId(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return REQUEST_ID_PATTERN.test(value) ? value : undefined;
}
