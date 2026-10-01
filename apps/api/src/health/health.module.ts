import { Module } from '@nestjs/common';

import { HealthController } from './health.controller.js';
import { READINESS_INDICATORS } from './readiness.js';
import type { ReadinessIndicator } from './readiness.js';

/**
 * Sondas registradas. Vacío en este hito: ver el comentario de `READINESS_INDICATORS`.
 *
 * Es el único sitio que hay que tocar para añadir una: `{ provide: READINESS_INDICATORS, useValue:
 * [...], multi: true }` o, mejor, una fábrica que inyecte el cliente correspondiente.
 */
const readinessIndicators: readonly ReadinessIndicator[] = [];

@Module({
  controllers: [HealthController],
  providers: [{ provide: READINESS_INDICATORS, useValue: readinessIndicators }],
})
export class HealthModule {}
