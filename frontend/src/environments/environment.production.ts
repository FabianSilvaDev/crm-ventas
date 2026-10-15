/**
 * Entorno de produccion.
 *
 * En esta version la aplicacion sigue siendo una demostracion: la API apunta al
 * backend local simulado. Al conectar agentes reales solo hay que cambiar
 * `apiBaseUrl`; el resto del frontend no se toca.
 */
import type { Environment } from './environment.types';

export const environment: Environment = {
  production: true,
  appName: 'AI Operations CMS',
  apiBaseUrl: 'http://localhost:3000/api/v1',
  defaultPollIntervalMs: 2000,
  healthCheckIntervalMs: 20000,
};
