import { Module, Provider } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import type { DynamicModule } from '@nestjs/common';

import { AuditInterceptor } from './audit/audit.interceptor.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import { DbModule } from './db/db.module.js';
import { HealthModule } from './health/health.module.js';
import { LeadsModule } from './leads/leads.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';

/**
 * Módulo raíz.
 *
 * Arranca con lo mínimo del Hito 1. Los módulos de dominio (auth, catálogo, investigación,
 * campañas, contenido, leads, analítica) se añaden aquí uno a uno; `docs/architecture.md` §4 fija
 * la dirección de dependencias entre ellos.
 *
 * Es **dinámico** porque necesita el entorno ya validado: `createApp(env)` es el único que lo
 * valida, y el contenedor tiene que recibir **esa** instancia, no una segunda lectura de
 * `process.env`. Ver el comentario de `ConfigModule.forRoot`.
 */
@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    const globalAuditInterceptor: Provider = {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    };

    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        PrismaModule,
        DbModule.forRoot(env),
        AuditModule,
        AuthModule,
        HealthModule,
        LeadsModule,
        WebhooksModule,
      ],
      providers: [globalAuditInterceptor],
    };
  }
}
