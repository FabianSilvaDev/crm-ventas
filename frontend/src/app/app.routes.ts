/**
 * Rutas del CMS.
 *
 * Cada seccion se carga de forma diferida (`loadComponent`) para que la carga
 * inicial no arrastre PixiJS ni las vistas administrativas mas pesadas
 * (seccion 6 del prompt: "utiliza Angular Router y lazy loading").
 */
import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'dashboard',
    title: 'Dashboard · AI Operations CMS',
    loadComponent: () => import('./features/dashboard/dashboard').then((module) => module.DashboardPage),
  },
  {
    path: 'opportunities',
    title: 'Oportunidades · AI Operations CMS',
    loadComponent: () => import('./features/opportunities/opportunities').then((module) => module.OpportunitiesPage),
  },
  {
    path: 'office',
    title: 'Oficina virtual · AI Operations CMS',
    loadComponent: () => import('./features/virtual-office/office').then((module) => module.OfficePage),
  },
  {
    path: 'workflows',
    title: 'Flujo de agentes · AI Operations CMS',
    loadComponent: () => import('./features/workflows/workflows').then((module) => module.WorkflowsPage),
  },
  {
    path: 'agents',
    title: 'Agentes · AI Operations CMS',
    loadComponent: () => import('./features/agents/agents').then((module) => module.AgentsPage),
  },
  {
    path: 'research',
    title: 'Investigacion de mercado · AI Operations CMS',
    loadComponent: () => import('./features/research/research').then((module) => module.ResearchPage),
  },
  {
    path: 'products',
    title: 'Productos y ofertas · AI Operations CMS',
    loadComponent: () => import('./features/products/products').then((module) => module.ProductsPage),
  },
  {
    path: 'content',
    title: 'Contenido y creatividades · AI Operations CMS',
    loadComponent: () => import('./features/content/content').then((module) => module.ContentPage),
  },
  {
    path: 'landing-pages',
    title: 'Landing pages · AI Operations CMS',
    loadComponent: () => import('./features/landing-pages/landing-pages').then((module) => module.LandingPagesPage),
  },
  {
    path: 'campaigns',
    title: 'Campanas · AI Operations CMS',
    loadComponent: () => import('./features/campaigns/campaigns').then((module) => module.CampaignsPage),
  },
  {
    path: 'leads',
    title: 'Leads y ventas · AI Operations CMS',
    loadComponent: () => import('./features/leads/leads').then((module) => module.LeadsPage),
  },
  {
    path: 'analytics',
    title: 'Analitica · AI Operations CMS',
    loadComponent: () => import('./features/analytics/analytics').then((module) => module.AnalyticsPage),
  },
  {
    path: 'settings',
    title: 'Configuracion · AI Operations CMS',
    loadComponent: () => import('./features/settings/settings').then((module) => module.SettingsPage),
  },
  {
    // Cualquier ruta desconocida vuelve al dashboard en lugar de dejar la vista vacia.
    path: '**',
    redirectTo: 'dashboard',
  },
];
