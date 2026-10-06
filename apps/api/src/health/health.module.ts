import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import { HealthController } from './health.controller.js';
import { PrismaReadinessIndicator } from './prisma-readiness.indicator.js';
import { READINESS_INDICATORS } from './readiness.js';

/**
 * Módulo de sondas de infraestructura.
 *
 * Hito 1: solo la sonda de MySQL vía Prisma. Cuando entre Redis/BullMQ (worker) se añadirá aquí
 * una segunda sonda sin tocar `HealthController`.
 */
@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [
    PrismaReadinessIndicator,
    {
      provide: READINESS_INDICATORS,
      useFactory: (prisma: PrismaReadinessIndicator) => [prisma],
      inject: [PrismaReadinessIndicator],
    },
  ],
})
export class HealthModule {}
