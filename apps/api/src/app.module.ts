import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';

import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import { HealthModule } from './health/health.module.js';
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
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(env), HealthModule, WebhooksModule],
    };
  }
}
