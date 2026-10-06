import { DynamicModule, Inject, Injectable, Module, OnModuleInit } from '@nestjs/common';

import { ConfigModule } from '../config/config.module.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { seedIfEmpty } from './seed.js';

/**
 * Módulo de persistencia.
 *
 * En la Fase 1 proveía la base de datos JSON (`JsonDb`) y el seed. Después de la migración a
 * Prisma/MySQL solo conserva el `SeedService`: la conexión y los repositorios viven en
 * `PrismaModule`.
 */
@Injectable()
class SeedService implements OnModuleInit {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await seedIfEmpty(this.env, this.prisma);
  }
}

@Module({})
export class DbModule {
  static forRoot(_env: Env): DynamicModule {
    return {
      module: DbModule,
      global: true,
      imports: [ConfigModule, PrismaModule],
      providers: [SeedService],
    };
  }
}
