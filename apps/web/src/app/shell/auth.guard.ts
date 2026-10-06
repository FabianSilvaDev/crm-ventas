import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';

import { SessionService } from '../core/session';

/**
 * Puerta de las pantallas del CRM.
 *
 * ## Esto es UX, NO es seguridad
 *
 * Está escrito aquí y no solo en la documentación porque es el sitio donde alguien va a leerlo. Lo
 * único que hace este guard es **no enseñar** una pantalla a quien no tiene sesión. Cualquiera puede
 * saltárselo: basta con abrir las herramientas del navegador, o llamar al API directamente con `curl`.
 *
 * La autorización de verdad es `@RequirePermission` **en el servidor** (`docs/security.md` §3.4), con
 * el `permission` del token y la política de cada recurso en la base de datos. Ese control ya existe
 * en el módulo de auth (ADR-024 y ADR-025); este guard sigue siendo solo UX, no seguridad.
 *
 * ## Por qué espera a `ensureRestored()` y no lee un booleano
 *
 * Al recargar la página el access token no está —vive en memoria, por diseño (`docs/security.md`
 * §2.2)— y la sesión se recupera con `POST /auth/refresh` y la cookie `__Host-crm_rt`. Eso es una
 * petición al API, así que el guard tiene que ser asíncrono: devolver `false` antes de que conteste
 * expulsaría a un usuario con sesión válida en cada recarga.
 *
 * Es idempotente: en la segunda navegación no vuelve a preguntar. Y los fallos no concluyentes —el API
 * sin arrancar, la ruta sin montar— se olvidan, de modo que arrancarlo con la pestaña abierta basta
 * para entrar sin recargar.
 *
 * ## A dónde manda cuando no hay sesión
 *
 * A `/entrar`, con la pantalla que se pedía en `returnTo` para devolver al usuario donde quería ir.
 * Ese parámetro lo valida el acceso con `destinoSeguro` (`core/navigation.ts`) antes de usarlo: aquí
 * se escribe un valor interno, pero quien lo lee no puede fiarse de eso.
 */
export const authGuard: CanActivateFn = async (_ruta, estado) => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (await session.ensureRestored()) {
    return true;
  }

  return router.createUrlTree(['/entrar'], { queryParams: { returnTo: estado.url } });
};
