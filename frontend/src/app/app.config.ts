/**
 * Configuracion de la aplicacion.
 *
 * - `provideRouter` con las rutas del CMS (carga diferida por seccion).
 * - `provideHttpClient` con `withFetch` para hablar con la API simulada.
 * - Restauracion del scroll al navegar y enlaces con `input` vinculados a los
 *   parametros de ruta, utiles para las vistas con filtros en la URL.
 */
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Angular 22 arranca sin zone.js: el estado vive en signals y en las
    // suscripciones de RxJS que los alimentan, asi que no se pierde ninguna
    // actualizacion de vista.
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
  ],
};
