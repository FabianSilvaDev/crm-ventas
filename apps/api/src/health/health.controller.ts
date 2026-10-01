import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';

import { READINESS_INDICATORS } from './readiness.js';
import type { ReadinessIndicator } from './readiness.js';

interface LivenessResponse {
  readonly status: 'ok';
  readonly timestamp: string;
}

interface CheckResult {
  readonly name: string;
  readonly status: 'up' | 'down';
  readonly durationMs: number;
}

interface ReadinessResponse {
  readonly status: 'ok' | 'not_ready';
  readonly timestamp: string;
  readonly checks: readonly CheckResult[];
}

/**
 * Endpoints de infraestructura. **Fuera** de `/api/v1` y sin versionar (`docs/api.md` §1.1).
 *
 * `/metrics` vivirá aquí al lado cuando entre la instrumentación.
 */
@Controller('health')
export class HealthController {
  constructor(
    @Inject(READINESS_INDICATORS)
    private readonly indicators: readonly ReadinessIndicator[],
  ) {}

  /**
   * Liveness: responde si el proceso está en pie. **No consulta dependencias** a propósito.
   *
   * Si esta sonda consultara Postgres, un Postgres caído haría que el orquestador reiniciara el
   * API en bucle sin arreglar nada y perdiendo las peticiones en curso.
   */
  @Get('live')
  live(): LivenessResponse {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Readiness: responde si podemos atender tráfico. Devuelve **503** si alguna dependencia falla.
   *
   * Con `passthrough` no se controla la respuesta entera: se fija el status y Nest sigue
   * serializando el valor devuelto, de modo que el cuerpo sigue siendo JSON de health y no un
   * problem+json.
   *
   * Mientras `READINESS_INDICATORS` esté vacío esto devuelve `ok` sin comprobar nada. Ver el
   * comentario del token en `readiness.ts`: es información deliberada, no un descuido.
   */
  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response): Promise<ReadinessResponse> {
    const settled = await Promise.all(
      this.indicators.map(async (indicator): Promise<CheckResult> => {
        const startedAt = performance.now();
        const up = await indicator.check().catch(() => false);
        return {
          name: indicator.name,
          status: up ? 'up' : 'down',
          durationMs: Math.round(performance.now() - startedAt),
        };
      }),
    );

    const ready = settled.every((check) => check.status === 'up');
    if (!ready) {
      response.status(503);
    }

    return {
      status: ready ? 'ok' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: settled,
    };
  }
}
