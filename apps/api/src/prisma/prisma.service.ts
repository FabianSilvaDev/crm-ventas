import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

/**
 * Cliente Prisma como servicio NestJS.
 *
 * Se conecta al arrancar el módulo y se desconecta al destruirlo. El módulo es global para que los
 * repositorios de dominio lo reciban sin tener que importar `PrismaModule` en cada módulo.
 *
 * Recibe `Env` por inyección para respetar la URL de base de datos que le pasó `createApp`. Si no lo
 * hiciera, leería el `DATABASE_URL` del schema o del `.env` y los tests terminarían hablando con la
 * base de desarrollo en lugar de `crm_test`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    super({ datasources: { db: { url: env.DATABASE_URL } } });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
