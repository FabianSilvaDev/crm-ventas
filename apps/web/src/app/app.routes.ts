import type { Routes } from '@angular/router';

/**
 * Rutas de la SPA.
 *
 * Todo se carga con `loadComponent` (lazy): el CRM acabará teniendo 14 etapas y cargar el
 * bundle entero en el primer render castiga el arranque sin ninguna ganancia.
 *
 * Los imports van SIN extensión `.js`. Esto es una diferencia real con `apps/api` y no una
 * inconsistencia: la SPA se empaqueta con el builder de Angular (resolución tipo bundler), no
 * la ejecuta Node directamente. La regla de la extensión `.js` aplica a lo que compila y ejecuta
 * `tsc` + `node`.
 */
export const routes: Routes = [
  {
    // La pantalla de entrada del CRM. Es el producto: las 14 etapas existen para llegar aquí.
    // Todavía no puede mostrar leads reales —no hay base de datos— y lo dice en vez de disimularlo.
    path: 'leads',
    title: 'Leads · CRM de Ventas',
    loadComponent: () => import('./features/leads/leads').then((m) => m.Leads),
  },
  {
    path: 'sistema',
    title: 'Estado del sistema · CRM de Ventas',
    loadComponent: () => import('./features/system-status/system-status').then((m) => m.SystemStatus),
  },
  { path: '', pathMatch: 'full', redirectTo: 'leads' },
  { path: '**', redirectTo: 'leads' },
];
