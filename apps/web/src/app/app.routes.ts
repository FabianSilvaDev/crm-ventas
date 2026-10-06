import type { Routes } from '@angular/router';

import { authGuard } from './shell/auth.guard';

/**
 * Rutas de la SPA.
 *
 * Todo se carga con `loadComponent` (lazy): el CRM crecerá a 7 áreas mentales principales y
 * cargar el bundle entero en el primer render castiga el arranque sin ninguna ganancia.
 *
 * Los imports van SIN extensión `.js`. La SPA se empaqueta con el builder de Angular (resolución
 * tipo bundler), no la ejecuta Node directamente.
 *
 * ── Estructura: el shell es una RUTA, no la raíz de la aplicación ─────────────
 * `Layout` es el padre y las pantallas son sus hijas. Esto permite que exista una pantalla
 * **fuera** del shell: el acceso (`/entrar`) no lleva navegación. `/entrar` está declarada
 * **antes** de este bloque para evitar que el padre con `path: ''` y el wildcard se la traguen.
 *
 * ── Navegación nueva vs. rutas legado ─────────────────────────────────────────
 * La navegación principal ahora responde a modelos mentales (Home, Growth, Sales, Products,
 * AI, Analytics, Settings). Las rutas viejas del ciclo comercial se redirigen a las nuevas
 * áreas para no romper enlaces; las que aún tienen datos reales (`/leads`, `/sistema`) se
 * mantienen activas durante la migración.
 */
export const routes: Routes = [
  {
    // Setup inicial: también fuera del shell. Se carga antes que /entrar para que, si la BD está
    // vacía, el login pueda redirigir aquí sin rebotar contra el wildcard del shell.
    path: 'setup',
    title: 'Configurar · CRM de Ventas',
    loadComponent: () => import('./features/setup/setup').then((m) => m.Setup),
  },
  {
    // El acceso: vive fuera del shell.
    path: 'entrar',
    title: 'Entrar · CRM de Ventas',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: '',
    loadComponent: () => import('./shell/layout').then((m) => m.Layout),
    // El guard protege el padre entero: cualquier hija futura queda detrás sin que nadie tenga que
    // acordarse de añadirlo. Es UX y no seguridad — ver `shell/auth.guard.ts` y ADR-024.
    canActivate: [authGuard],
    children: [
      // ── Nuevas áreas mentales ─────────────────────────────────────────────
      {
        path: 'home',
        title: 'Inicio · CRM de Ventas',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'growth',
        title: 'Growth · CRM de Ventas',
        loadComponent: () => import('./features/growth/growth').then((m) => m.Growth),
      },
      {
        path: 'sales',
        title: 'Ventas · CRM de Ventas',
        loadComponent: () => import('./features/sales/sales').then((m) => m.Sales),
      },
      {
        path: 'products',
        title: 'Productos · CRM de Ventas',
        loadComponent: () => import('./features/products/products').then((m) => m.Products),
      },
      {
        path: 'ai',
        title: 'IA · CRM de Ventas',
        loadComponent: () => import('./features/ai/ai').then((m) => m.Ai),
      },
      {
        path: 'analytics',
        title: 'Analytics · CRM de Ventas',
        loadComponent: () => import('./features/analytics/analytics').then((m) => m.Analytics),
      },
      {
        path: 'settings',
        title: 'Configuración · CRM de Ventas',
        loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
      },
      {
        path: 'settings/users',
        title: 'Usuarios · CRM de Ventas',
        loadComponent: () => import('./features/settings/users/users').then((m) => m.Users),
      },

      // ── Rutas legado con datos reales: se mantienen activas ─────────────────
      {
        path: 'leads',
        title: 'Leads · CRM de Ventas',
        loadComponent: () => import('./features/leads/leads').then((m) => m.Leads),
      },
      {
        path: 'sistema',
        title: 'Estado del sistema · CRM de Ventas',
        loadComponent: () =>
          import('./features/system-status/system-status').then((m) => m.SystemStatus),
      },

      // ── Rutas legado vacías: redirects a las nuevas áreas mentales ──────────
      { path: 'panel', pathMatch: 'full', redirectTo: 'home' },
      { path: 'investigacion', pathMatch: 'full', redirectTo: 'products' },
      { path: 'estrategia', pathMatch: 'full', redirectTo: 'growth' },
      { path: 'adquisicion', pathMatch: 'full', redirectTo: 'growth' },
      { path: 'ventas', pathMatch: 'full', redirectTo: 'sales' },
      { path: 'aprendizaje', pathMatch: 'full', redirectTo: 'analytics' },

      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: '**', redirectTo: 'home' },
    ],
  },
];
