import 'reflect-metadata';

import { Logger } from '@nestjs/common';

import { createApp } from './app.factory.js';
import { loadEnvFileIfPresent } from './config/env-file.js';
import { loadEnv } from './config/env.js';

/**
 * Punto de entrada. Deliberadamente delgado: **todo el montaje de la aplicación vive en
 * `createApp`**, para que los tests levanten exactamente el mismo pipeline y no una imitación.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // El `.env` primero, y solo aquí: `loadEnv` es pura y no debe depender de un fichero que no está
  // versionado. El entorno real gana sobre el fichero (comprobado), así que en un despliegue esto
  // es un no-op.
  const envFile = loadEnvFileIfPresent();

  // Valida el entorno ANTES de crear la app: si la configuración está mal, no queremos un
  // proceso a medio arrancar escuchando en un puerto.
  const env = loadEnv();

  const app = await createApp(env);

  await app.listen(env.PORT);

  logger.log(
    `API escuchando en http://localhost:${env.PORT} ` +
      `(entorno: ${env.NODE_ENV}, prefijo de negocio: /api/v1)`,
  );

  // Saber de dónde salió la configuración ahorra el rato más tonto del despliegue: creer que estás
  // usando el `.env` cuando el proceso se lanzó desde otro directorio.
  logger.log(
    envFile === undefined
      ? 'Sin fichero .env: la configuración viene solo del entorno del proceso.'
      : `Configuración leída de ${envFile} (el entorno del proceso tiene prioridad).`,
  );
}

bootstrap().catch((error: unknown) => {
  // `process.exitCode` en vez de `process.exit()`: deja que el proceso muera solo, sin cortar
  // una escritura de log a medias.
  new Logger('Bootstrap').error(
    'El API no pudo arrancar',
    error instanceof Error ? error.stack : String(error),
  );
  process.exitCode = 1;
});
