import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';

import type { Env } from './env.js';

/**
 * Token del entorno dentro del contenedor de dependencias.
 *
 * Un `Symbol` y no la cadena `'ENV'`: dos módulos que declaren `'ENV'` por su cuenta colisionarían
 * en silencio y uno de los dos recibiría la configuración del otro. Mismo criterio que
 * `READINESS_INDICATORS` en `health/readiness.ts`.
 */
export const ENV = Symbol('crm:env');

/**
 * Publica el entorno ya validado para inyectarlo donde haga falta.
 *
 * Es un módulo **dinámico** (`forRoot(env)`) y no un `loadEnv()` dentro de la fábrica, por una razón
 * concreta: el entorno se valida **una sola vez**, en `main.ts`, y esa instancia es la que circula.
 * Cargarlo otra vez aquí daría dos lecturas de `process.env` que pueden discrepar — y en un test con
 * `process.env` manipulado, discreparían sin avisar.
 */
@Module({})
export class ConfigModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: ConfigModule,
      // Global: pedirla por token en cada módulo que la necesite sería ruido sin beneficio.
      global: true,
      providers: [{ provide: ENV, useValue: env }],
      exports: [ENV],
    };
  }
}
