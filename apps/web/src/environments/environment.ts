/**
 * Entorno de **desarrollo** (es el que usa `ng serve` y el que ejecuta la suite de tests).
 *
 * Este fichero existe por un solo valor booleano: la puerta de la sesión de demostración. En el
 * build de producción, `angular.json` lo sustituye por `environment.production.ts`, donde ese valor
 * está compilado a `false`. Ver el comentario de `puertaDeDemostracionAbierta` en `core/session.ts`.
 *
 * **No lleva ninguna URL de API dentro**, y eso es deliberado: el cliente habla con rutas relativas
 * (`/api/v1/...`) y `proxy.conf.json` se encarga de reenviarlas en desarrollo. Un bundle con la URL
 * del API embebida obliga a reconstruir la SPA para cambiar de entorno, que es justo lo que este
 * proyecto evita.
 */
export const environment = {
  /** Ver `puertaDeDemostracionAbierta`: sola no basta, `isDevMode()` tiene que acompañar. */
  demoSession: true,
} as const;
