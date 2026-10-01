/**
 * Navegación del CRM: las 14 etapas del ciclo comercial de `PrompInicial.MD`, agrupadas por la
 * fase del embudo a la que pertenecen.
 *
 * `path: null` significa **la pantalla todavía no existe**. No es un placeholder decorativo: se
 * renderiza como texto no interactivo con la etiqueta "pendiente", en vez de como un enlace que
 * lleva a una página vacía. Un menú lleno de enlaces muertos es peor que un menú corto, porque
 * el usuario deja de fiarse de él.
 *
 * Cuando se implemente una etapa, se le pone `path` y el elemento se convierte en enlace solo.
 */
export interface NavItem {
  readonly label: string;
  readonly path: string | null;
}

export interface NavGroup {
  readonly heading: string;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    heading: 'Investigación',
    items: [
      { label: 'Nicho', path: null },
      { label: 'Investigación', path: null },
      { label: 'Productos', path: null },
      { label: 'Selección', path: null },
    ],
  },
  {
    heading: 'Estrategia y presencia',
    items: [
      { label: 'Estrategia', path: null },
      { label: 'Contenido', path: null },
      { label: 'Landing', path: null },
      { label: 'SEO', path: null },
    ],
  },
  {
    heading: 'Adquisición',
    items: [
      { label: 'Campaña', path: null },
      { label: 'Publicidad', path: null },
      { label: 'Leads', path: '/leads' },
    ],
  },
  {
    heading: 'Ventas',
    items: [{ label: 'Ventas', path: null }],
  },
  {
    heading: 'Aprendizaje',
    items: [
      { label: 'Analítica', path: null },
      { label: 'Optimización', path: null },
    ],
  },
];

/** Lo que hoy existe de verdad. Se mantiene aparte porque no es una etapa del ciclo. */
export const SYSTEM_NAV: readonly NavItem[] = [{ label: 'Estado del sistema', path: '/sistema' }];
