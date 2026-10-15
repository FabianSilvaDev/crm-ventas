/**
 * Definicion de la navegacion lateral.
 *
 * Es la unica lista de secciones del CMS: la usan el sidebar (para pintar el menu)
 * y el header (para titular la seccion activa a partir de la URL). Anadir una
 * seccion es anadir una entrada aqui y su ruta en `app.routes.ts`.
 */
import type { PixelIconName } from '../../shared/pixel/icons';

export interface NavItem {
  /** Ruta de Angular Router. */
  path: string;
  label: string;
  icon: PixelIconName;
  /** Acento del icono: identifica el area sin depender del color del texto. */
  accent: string;
  /** Descripcion corta, usada en el titulo de la pagina y en el buscador. */
  description: string;
  /** Grupo al que pertenece dentro del menu. */
  group: 'Operacion' | 'Departamentos' | 'Comercial' | 'Sistema';
  /** Contador en vivo que debe mostrar el sidebar, si procede. */
  counter?: 'activeAgents' | 'runningRuns' | 'newLeads';
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: 'grid',
    accent: 'cyan',
    description: 'Estado general de la operacion y actividad reciente.',
    group: 'Operacion',
  },
  {
    path: '/opportunities',
    label: 'Oportunidades',
    icon: 'opportunity',
    accent: 'amber',
    description: 'Cola del intake: lo que Yanca ha registrado, con su evidencia, para que decidas.',
    group: 'Operacion',
  },
  {
    path: '/office',
    label: 'Oficina virtual',
    icon: 'office',
    accent: 'amber',
    description: 'Escenario pixel art con los agentes en su departamento.',
    group: 'Operacion',
    counter: 'activeAgents',
  },
  {
    path: '/workflows',
    label: 'Flujo de agentes',
    icon: 'flow',
    accent: 'green',
    description: 'Las 17 etapas, del descubrimiento de la oportunidad al aprendizaje.',
    group: 'Operacion',
    counter: 'runningRuns',
  },
  {
    path: '/agents',
    label: 'Agentes',
    icon: 'agents',
    accent: 'blue',
    description: 'Plantilla de agentes, especialidades y tareas simuladas.',
    group: 'Operacion',
    counter: 'activeAgents',
  },
  {
    path: '/research',
    label: 'Investigacion de mercado',
    icon: 'research',
    accent: 'cyan',
    description: 'Informes de mercado, tendencias, competencia y validacion.',
    group: 'Departamentos',
  },
  {
    path: '/products',
    label: 'Productos y ofertas',
    icon: 'products',
    accent: 'lime',
    description: 'Catalogo investigado y las ofertas derivadas de cada producto.',
    group: 'Departamentos',
  },
  {
    path: '/content',
    label: 'Contenido y creatividades',
    icon: 'content',
    accent: 'violet',
    description: 'Piezas de contenido, variantes creativas y su rendimiento.',
    group: 'Departamentos',
  },
  {
    path: '/landing-pages',
    label: 'Landing pages',
    icon: 'landing',
    accent: 'green',
    description: 'Paginas de conversion, variantes A/B y salud tecnica.',
    group: 'Departamentos',
  },
  {
    path: '/campaigns',
    label: 'Campanas',
    icon: 'campaigns',
    accent: 'orange',
    description: 'Campanas simuladas, presupuesto y retorno por canal.',
    group: 'Comercial',
  },
  {
    path: '/leads',
    label: 'Leads y ventas',
    icon: 'leads',
    accent: 'pink',
    description: 'Embudo comercial, cualificacion y seguimiento.',
    group: 'Comercial',
  },
  {
    path: '/analytics',
    label: 'Analitica',
    icon: 'analytics',
    accent: 'blue',
    description: 'Embudo, atribucion por canal y experimentos.',
    group: 'Comercial',
  },
  {
    path: '/settings',
    label: 'Configuracion',
    icon: 'settings',
    accent: 'gray',
    description: 'Workspace, simulacion, integraciones y limites del backend.',
    group: 'Sistema',
  },
] as const;

export const NAV_GROUPS: readonly NavItem['group'][] = ['Operacion', 'Departamentos', 'Comercial', 'Sistema'];

/** Seccion que corresponde a una URL; alimenta el titulo del header. */
export const navItemForUrl = (url: string): NavItem | undefined =>
  NAV_ITEMS.find((item) => url === item.path || url.startsWith(`${item.path}/`));
