/**
 * Forma de la configuracion de entorno.
 *
 * Vive en su propio fichero porque `angular.json` reemplaza
 * `environment.ts` por `environment.production.ts` al compilar en produccion: si la
 * version de produccion importara el tipo desde `./environment`, ese import se
 * resolveria contra si mismo y no encontraria la interfaz.
 */
export interface Environment {
  production: boolean;
  appName: string;
  /** API REST del backend Express. CORS ya permite el puerto 4200. */
  apiBaseUrl: string;
  /** Intervalo de sondeo de respaldo si la API no informa del suyo (ms). */
  defaultPollIntervalMs: number;
  /** Cadencia de comprobacion del estado de conexion con la API (ms). */
  healthCheckIntervalMs: number;
}
