import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';

/**
 * Configuración de arranque de la SPA.
 *
 * NO hay `provideZoneChangeDetection` y eso es deliberado: Angular 22 arranca **sin zone.js**.
 * Consecuencia práctica que hay que respetar en todo el código: el estado de los componentes va
 * en `signal()`. Una propiedad normal asignada dentro de un `await` no dispara detección de
 * cambios y la vista se queda congelada sin dar ningún error. Ver docs/design-system.md.
 *
 * `withFetch()` usa la Fetch API en vez de XHR: es la implementación mantenida y permite que el
 * día que esto pase a SSR funcione igual.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withFetch()),
  ],
};
