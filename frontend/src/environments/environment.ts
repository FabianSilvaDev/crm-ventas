/**
 * Configuracion de entorno del frontend (desarrollo).
 *
 * La URL base de la API vive aqui y en `environment.production.ts`; los servicios la
 * leen de este fichero y nadie mas la escribe a mano (seccion 14 del prompt). El
 * reemplazo de fichero segun la configuracion de build se declara en
 * `angular.json` -> `fileReplacements`.
 */
import type { Environment } from './environment.types';

export type { Environment };

export const environment: Environment = {
  production: false,
  appName: 'AI Operations CMS',
  apiBaseUrl: 'http://localhost:3000/api/v1',
  defaultPollIntervalMs: 2000,
  healthCheckIntervalMs: 15000,
};
