import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';
import { traceIdMiddleware } from './common/trace-id.middleware.js';
import type { Env } from './config/env.js';

export interface CreateAppOptions {
  /**
   * Registra los ganchos de cierre ordenado (`SIGTERM`/`SIGINT`). Por defecto `true`.
   *
   * Los tests lo desactivan: cada app creada añade un listener al proceso, y una suite que crea
   * varias agotaría el límite de listeners y llenaría la salida de avisos que no son del test.
   */
  readonly shutdownHooks?: boolean;
}

/**
 * Construye el API completo a partir de un entorno ya validado.
 *
 * Existe separada de `main.ts` para que los tests puedan levantar **la aplicación real** —con su
 * prefijo, su middleware, sus filtros y sus pipes— escuchando en un puerto efímero, sin añadir
 * Supertest ni `@nestjs/testing`. Lo que se prueba es el pipeline de verdad, no una imitación.
 *
 * `main.ts` queda reducido a cargar el entorno, crear y escuchar.
 */
export async function createApp(
  env: Env,
  options: CreateAppOptions = {},
): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(env), {
    logger: env.NODE_ENV === 'production' ? ['error', 'warn', 'log'] : undefined,

    // **`rawBody` no es opcional.** La firma HMAC de los webhooks (`docs/api.md` §8.2) se calcula
    // sobre los bytes que llegaron por el cable, y verificar sobre el objeto ya parseado —o peor,
    // sobre `JSON.stringify(req.body)`— da un resultado distinto y **falla en silencio**: la firma
    // no coincide, el webhook se rechaza, y el error apunta al emisor en vez de a nosotros.
    // Con esto, Express deja además el cuerpo crudo en `req.rawBody` y Nest ofrece `@RawBody()`.
    rawBody: true,
  });

  // Los endpoints de negocio van versionados; los de infraestructura NO (`docs/api.md` §1.1).
  app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });

  // Correlación de toda petición. Ver la nota de `traceIdMiddleware` sobre por qué `app.use` y
  // no `MiddlewareConsumer` (Express 5 cambió la sintaxis de comodines).
  app.use(traceIdMiddleware);

  // El refresh token viaja en una cookie `__Host-`, así que las credenciales son obligatorias y
  // el origen debe ser explícito: `Access-Control-Allow-Credentials` no admite comodines.
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });

  app.useGlobalFilters(new ProblemDetailsFilter(env.NODE_ENV === 'production'));

  // Validación de entrada. **Global, pero no «a secas»**: el pipe solo valida los parámetros que
  // declaran `{ schema }` en su decorador (`@Body({ schema })`, `@Query({ schema })`) y deja pasar el
  // resto — un `@Param('id')` es un string y no debe validarse contra nada. No hay decoradores
  // propios: Nest 12 transporta el schema en los metadatos del parámetro y lo entrega a este pipe.
  //
  // Se registra aquí y no como `APP_PIPE` en `AppModule` porque `ZodValidationPipe` no tiene
  // dependencias que inyectar; tenerlo junto al filtro hace que el pipeline completo se lea de una
  // sola pasada. Cuando alguna validación necesite una dependencia (un reloj, un repositorio), pasa
  // a `APP_PIPE` sin cambiar nada de las rutas.
  app.useGlobalPipes(new ZodValidationPipe());

  if (options.shutdownHooks !== false) {
    // Cierra conexiones de forma ordenada al recibir SIGTERM/SIGINT (lo que hace un despliegue).
    // Hoy no hay clientes que cerrar; se deja puesto para que el día que los haya no se olvide.
    app.enableShutdownHooks();
  }

  // Identificar el framework en cada respuesta es regalar información al atacante.
  const httpAdapter = app.getHttpAdapter().getInstance() as { disable(name: string): void };
  httpAdapter.disable('x-powered-by');

  return app;
}
