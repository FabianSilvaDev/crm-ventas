import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { ProblemDetails } from '@crm/contracts';

/**
 * Cliente de las sondas de infraestructura.
 *
 * `/health/*` queda **fuera** de `/api/v1` y no forma parte del contrato versionado
 * (`docs/api.md` §1.1), así que sus formas se declaran aquí y no en `@crm/contracts`. La
 * duplicación es deliberada y está acotada: son dos respuestas de infraestructura, no dominio.
 * Lo que SÍ se consume del paquete compartido es `ProblemDetails`, porque el error que devuelve
 * el API es el mismo contrato que ve cualquier otro cliente. Ese cruce es justamente el motivo
 * por el que el monorepo comparte una sola versión de TypeScript.
 */

export interface LivenessResponse {
  readonly status: 'ok';
  readonly timestamp: string;
}

export interface ReadinessCheck {
  readonly name: string;
  readonly status: 'up' | 'down';
  readonly durationMs: number;
}

export interface ReadinessResponse {
  readonly status: 'ok' | 'not_ready';
  readonly timestamp: string;
  readonly checks: readonly ReadinessCheck[];
}

/**
 * `problem`  → el API respondió, pero con un error del contrato (4xx/5xx problem+json).
 * `unreachable` → no hubo respuesta: proceso caído, puerto equivocado, red.
 *
 * Se distinguen porque exigen acciones distintas, y mezclarlas convierte un API caído en un
 * "error 500" que apunta al sitio equivocado.
 */
export type ProbeOutcome = 'ok' | 'problem' | 'unreachable';

export interface Probe<T> {
  readonly outcome: ProbeOutcome;
  readonly httpStatus: number | null;
  readonly latencyMs: number;
  readonly traceId: string | null;
  readonly body: T | null;
  readonly problem: ProblemDetails | null;
  readonly transportError: string | null;
}

const TRACE_ID_HEADER = 'X-Trace-Id';

@Injectable({ providedIn: 'root' })
export class HealthService {
  readonly #http = inject(HttpClient);

  live(): Promise<Probe<LivenessResponse>> {
    return this.#probe<LivenessResponse>('/health/live');
  }

  ready(): Promise<Probe<ReadinessResponse>> {
    return this.#probe<ReadinessResponse>('/health/ready');
  }

  async #probe<T>(path: string): Promise<Probe<T>> {
    const startedAt = performance.now();

    try {
      const response = await firstValueFrom(
        this.#http.get<T>(path, { observe: 'response' }),
      );
      return {
        outcome: 'ok',
        httpStatus: response.status,
        latencyMs: Math.round(performance.now() - startedAt),
        traceId: response.headers.get(TRACE_ID_HEADER),
        body: response.body,
        problem: null,
        transportError: null,
      };
    } catch (error: unknown) {
      const latencyMs = Math.round(performance.now() - startedAt);

      if (!(error instanceof HttpErrorResponse)) {
        return {
          outcome: 'unreachable',
          httpStatus: null,
          latencyMs,
          traceId: null,
          body: null,
          problem: null,
          transportError: 'Fallo inesperado en el cliente HTTP.',
        };
      }

      // status 0 = no hubo respuesta HTTP (el navegador no llegó al servidor).
      if (error.status === 0) {
        return {
          outcome: 'unreachable',
          httpStatus: null,
          latencyMs,
          traceId: null,
          body: null,
          problem: null,
          transportError: 'No hubo respuesta del API. ¿Está arrancado en el puerto 3000?',
        };
      }

      const problem = asProblemDetails(error);
      return {
        outcome: problem === null ? 'unreachable' : 'problem',
        httpStatus: error.status,
        latencyMs,
        traceId: error.headers.get(TRACE_ID_HEADER),
        body: null,
        problem,
        transportError: problem === null ? 'Respuesta de error con un cuerpo inesperado.' : null,
      };
    }
  }
}

/**
 * Reconoce un `ProblemDetails` sin fiarse del cliente.
 *
 * Se comprueba que existan `code` y `title` antes de aceptarlo: un error del API puede llegar
 * como HTML (un proxy caído devuelve su propia página), y pintar eso como si fuera un problema
 * del contrato daría al usuario un mensaje sin sentido.
 */
function asProblemDetails(error: HttpErrorResponse): ProblemDetails | null {
  const raw: unknown = error.error;
  const candidate: unknown = typeof raw === 'string' ? parseJson(raw) : raw;

  if (candidate === null || typeof candidate !== 'object') {
    return null;
  }

  const value = candidate as Record<string, unknown>;
  if (typeof value['code'] !== 'string' || typeof value['title'] !== 'string') {
    return null;
  }

  return candidate as ProblemDetails;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
