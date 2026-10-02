import type { IconName } from './ui/icon/icon';

/**
 * Navegación del CRM.
 *
 * Este archivo está en transición de la navegación antigua (sidebar basada en etapas del ciclo
 * comercial) a la navegación nueva (top/bottom basada en modelos mentales: Home, Growth, Sales,
 * Products, AI, Analytics, Settings).
 *
 * Los bloques marcados como `/** @deprecated *\/` pertenecen al shell lateral anterior y se
 * eliminarán una vez que el nuevo `shell/layout` esté estable y las rutas viejas hayan sido
 * retiradas.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   NAVEGACIÓN NUEVA — modelos mentales del usuario
   ═══════════════════════════════════════════════════════════════════════════ */

/** Un enlace de navegación principal. `icon` es el nombre de un icono registrado en `ui/icon`. */
export interface NavLink {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  /** Nombre del icono en el catálogo de `IconComponent`. */
  readonly icon: IconName;
  /** Tecla de acceso rápido futura (command palette). */
  readonly shortcut?: string;
}

/** Navegación principal del producto. Aparece en top nav (desktop) y bottom nav (mobile). */
export const MAIN_NAV: readonly NavLink[] = [
  { id: 'home', label: 'Inicio', path: '/home', icon: 'home' },
  { id: 'growth', label: 'Growth', path: '/growth', icon: 'growth' },
  { id: 'sales', label: 'Ventas', path: '/sales', icon: 'sales' },
  { id: 'products', label: 'Productos', path: '/products', icon: 'products' },
  { id: 'ai', label: 'IA', path: '/ai', icon: 'ai' },
  { id: 'analytics', label: 'Analytics', path: '/analytics', icon: 'analytics' },
];

/** Navegación secundaria: accede desde el menú de usuario o drawer "Más". */
export const SECONDARY_NAV: readonly NavLink[] = [
  { id: 'settings', label: 'Configuración', path: '/settings', icon: 'settings' },
];

/** Navegación inferior en mobile. Cinco ítems principales; Products y Settings salen del drawer. */
export const BOTTOM_NAV: readonly NavLink[] = [
  { id: 'home', label: 'Inicio', path: '/home', icon: 'home' },
  { id: 'growth', label: 'Growth', path: '/growth', icon: 'growth' },
  { id: 'sales', label: 'Ventas', path: '/sales', icon: 'sales' },
  { id: 'ai', label: 'IA', path: '/ai', icon: 'ai' },
  { id: 'analytics', label: 'Analytics', path: '/analytics', icon: 'analytics' },
];

/** Rutas que se muestran en el drawer "Más" de la bottom nav. */
export const MORE_NAV: readonly NavLink[] = [
  { id: 'products', label: 'Productos', path: '/products', icon: 'products' },
  ...SECONDARY_NAV,
];

/* ═══════════════════════════════════════════════════════════════════════════
   NAVEGACIÓN ANTIGUA — sidebar por etapas del ciclo comercial
   ═══════════════════════════════════════════════════════════════════════════ */

/** @deprecated Usar `NavLink` y `MAIN_NAV` para el nuevo shell. */
export interface NavItem {
  readonly label: string;
  readonly path: string | null;
  /** Path SVG (atributo `d`) para el icono de 24×24. */
  readonly icon: string;
}

/** @deprecated Usar `MAIN_NAV` para el nuevo shell. */
export interface NavGroup {
  readonly heading: string;
  readonly items: readonly NavItem[];
}

/** @deprecated Reemplazado por iconos con nombre en `ui/icon`. */
const ICONS = {
  panel:
    'M4 4h6v6H4zm0 10h6v6H4zm10-10h6v6h-6zm0 10h6v6h-6z',
  nicho:
    'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm0-13a5 5 0 1 0 5 5 5 5 0 0 0-5-5z',
  investigacion:
    'm21 21-4.35-4.35M11 18a7 7 0 1 1 7-7 7 7 0 0 1-7 7z',
  productos:
    'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  seleccion:
    'M20 6 9 17l-5-5',
  estrategia:
    'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm-1-8H8v-2h3zm6 0h-3v-2h3zm-3 3v3h-2v-3z',
  contenido:
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6M8 12h8M8 16h8',
  landing:
    'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm2 0v4h14V5zm0 6v2h4v-2zm6 0v2h8v-2z',
  seo:
    'm21 21-4.35-4.35M11 18a7 7 0 1 1 7-7 7 7 0 0 1-7 7zM7 11h2v2H7z',
  campana:
    'M3 11l18-5M3 15l18-5M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z',
  publicidad:
    'M3 3v18h18M7 16v-5m4 5V8m4 8v-6m4 6V6',
  leads:
    'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 4 4 4 4 0 0 0-4-4zm8 4a3 3 0 1 0-3-3',
  conversaciones:
    'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  oportunidades:
    'M3 4h18l-2 7H5zm0 9h18v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  ventas:
    'M3 3v18h18M6 17l4-5 3 4 5-8',
  clientes:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 4 4 4 4 0 0 0-4-4zm11 2a3 3 0 1 0-3-3m0 7v2',
  analitica:
    'M3 3v18h18M6 17l4-5 3 4 5-8',
  optimizacion:
    'M12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm-1-6h2v5h-2zm0-4h2v2h-2z',
  sistema:
    'M22 12h-4l-3 9L9 3l-3 9H2',
} as const;

/** @deprecated */
export const HOME_NAV: readonly NavItem[] = [{ label: 'Panel', path: '/panel', icon: ICONS.panel }];

/** @deprecated */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    heading: 'Investigación',
    items: [
      { label: 'Nicho', path: null, icon: ICONS.nicho },
      { label: 'Investigación', path: '/investigacion', icon: ICONS.investigacion },
      { label: 'Productos', path: null, icon: ICONS.productos },
      { label: 'Selección', path: null, icon: ICONS.seleccion },
    ],
  },
  {
    heading: 'Estrategia',
    items: [
      { label: 'Estrategia', path: '/estrategia', icon: ICONS.estrategia },
      { label: 'Contenido', path: null, icon: ICONS.contenido },
      { label: 'Landing', path: null, icon: ICONS.landing },
      { label: 'SEO', path: null, icon: ICONS.seo },
    ],
  },
  {
    heading: 'Adquisición',
    items: [
      { label: 'Campaña', path: '/adquisicion', icon: ICONS.campana },
      { label: 'Publicidad', path: null, icon: ICONS.publicidad },
      { label: 'Leads', path: '/leads', icon: ICONS.leads },
    ],
  },
  {
    heading: 'Ventas',
    items: [
      { label: 'Conversaciones', path: null, icon: ICONS.conversaciones },
      { label: 'Oportunidades', path: null, icon: ICONS.oportunidades },
      { label: 'Ventas', path: '/ventas', icon: ICONS.ventas },
      { label: 'Clientes', path: null, icon: ICONS.clientes },
    ],
  },
  {
    heading: 'Aprendizaje',
    items: [
      { label: 'Analítica', path: '/aprendizaje', icon: ICONS.analitica },
      { label: 'Optimización', path: null, icon: ICONS.optimizacion },
    ],
  },
];

/** @deprecated */
export const SYSTEM_NAV: readonly NavItem[] = [
  { label: 'Estado del sistema', path: '/sistema', icon: ICONS.sistema },
];
