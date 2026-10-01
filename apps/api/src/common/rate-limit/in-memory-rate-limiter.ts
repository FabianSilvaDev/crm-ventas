import type { RateLimitDecision, RateLimiter } from './rate-limiter.js';

const WINDOW_MS = 60_000;

/**
 * Cuándo se barren las ventanas caducadas. Por debajo de este número no se paga el recorrido del
 * mapa en cada petición; por encima, se hace para que el mapa no crezca sin fin.
 */
const SWEEP_THRESHOLD = 1_000;

/**
 * Tope duro de claves simultáneas. Un atacante con IPs falsificadas puede crear una entrada por
 * petición: sin tope, el propio limitador se convierte en el vector de agotamiento de memoria.
 */
const MAX_KEYS = 10_000;

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Limitador de **ventana fija** por clave, en memoria del proceso.
 *
 * ## Qué es y qué no es
 *
 * Es suficiente para **una sola réplica** y para desarrollo. No lo es para producción con varias
 * réplicas, y el motivo está escrito en `rate-limiter.ts`: cada proceso cuenta por su cuenta.
 *
 * La ventana es **fija y no deslizante**: alguien puede hacer el doble de peticiones a caballo entre
 * dos ventanas. Se acepta a cambio de no guardar una marca de tiempo por petición; el objetivo aquí
 * es evitar que un endpoint público se convierta en un amplificador, no facturar por uso.
 *
 * El reloj se inyecta para poder probar los reinicios de ventana sin esperar un minuto real.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limitPerWindow: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitDecision {
    const currentTime = this.now();

    this.sweepIfNeeded(currentTime);

    let bucket = this.buckets.get(key);

    // Ojo con la segunda condición: una ventana **caducada** sigue en el mapa hasta que el barrido
    // la elimine, así que sin comprobarla aquí una IP que esperó su minuto seguiría bloqueada para
    // siempre en cuanto el mapa bajase del umbral de barrido.
    if (bucket === undefined || bucket.resetAt <= currentTime) {
      // Con el mapa lleno de ventanas vivas no se admiten claves nuevas: **fail-closed**. Bajo un
      // flood de IPs falsas es preferible denegar tráfico nuevo que crecer hasta tumbar el proceso.
      if (bucket === undefined && this.buckets.size >= MAX_KEYS) {
        return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };
      }

      bucket = { count: 0, resetAt: currentTime + WINDOW_MS };
      this.buckets.set(key, bucket);
    }

    bucket.count += 1;

    const allowed = bucket.count <= this.limitPerWindow;
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000));

    return {
      allowed,
      remaining: Math.max(0, this.limitPerWindow - bucket.count),
      retryAfterSeconds,
    };
  }

  private sweepIfNeeded(currentTime: number): void {
    if (this.buckets.size < SWEEP_THRESHOLD) {
      return;
    }

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= currentTime) {
        this.buckets.delete(key);
      }
    }
  }
}
