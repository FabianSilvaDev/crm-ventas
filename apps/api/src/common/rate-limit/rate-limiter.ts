/**
 * Límite de peticiones para los endpoints **públicos** (los que llama Meta, no un usuario nuestro).
 *
 * Se define como interfaz porque la implementación en memoria **no es válida en producción** con
 * más de una réplica: cada proceso lleva su propia cuenta, así que con N réplicas el límite efectivo
 * es N veces el configurado. El día que entre Redis (BullMQ ya está decidido en ADR-001/003) hay que
 * sustituir la implementación, y esta interfaz es lo que hace que eso no toque al controlador.
 */
export const RATE_LIMITER = Symbol('crm:rate-limiter');

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  /** Segundos hasta que la ventana se reinicie. Va en la cabecera `Retry-After` del 429. */
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  /**
   * Consume una unidad de la ventana de `key` y decide si la petición pasa.
   *
   * **Consume siempre**, incluso cuando deniega: si solo contara las permitidas, quien insiste
   * mantendría la ventana abierta indefinidamente.
   */
  check(key: string): RateLimitDecision;
}
