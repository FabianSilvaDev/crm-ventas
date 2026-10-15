/**
 * Departamentos de la oficina virtual (seccion 8 del prompt).
 * `room` es la posicion de la sala en la rejilla 4x2 del escenario pixel art;
 * el layout definitivo lo calcula el frontend a partir de estas coordenadas.
 */

/** Rejilla del escenario: 4 columnas x 2 filas de salas. */
export const OFFICE_GRID = { columns: 4, rows: 2 };

export const departments = [
  {
    id: 'ops-center',
    name: 'Operations Center',
    shortName: 'Operations',
    description:
      'Orquesta el ciclo completo: reparte tareas, vigila dependencias y escala bloqueos entre departamentos.',
    accent: 'amber',
    room: { col: 0, row: 0 },
    tile: { floor: 'floor-grid', wall: 'wall-panel', palette: 'amber' },
  },
  {
    id: 'research-lab',
    name: 'Research Lab',
    shortName: 'Research',
    description:
      'Investiga mercados, analiza competidores, detecta tendencias y valida la demanda antes de invertir.',
    accent: 'cyan',
    room: { col: 1, row: 0 },
    tile: { floor: 'floor-lab', wall: 'wall-lab', palette: 'cyan' },
  },
  {
    id: 'marketing-studio',
    name: 'Marketing Studio',
    shortName: 'Marketing',
    description:
      'Convierte hallazgos en ofertas, mensajes y piezas de copy listas para cada canal.',
    accent: 'violet',
    room: { col: 2, row: 0 },
    tile: { floor: 'floor-studio', wall: 'wall-studio', palette: 'violet' },
  },
  {
    id: 'creative-studio',
    name: 'Creative Studio',
    shortName: 'Creative',
    description:
      'Produce creatividades, variantes visuales y recursos de marca para campanas y landings.',
    accent: 'pink',
    room: { col: 3, row: 0 },
    tile: { floor: 'floor-studio', wall: 'wall-studio', palette: 'pink' },
  },
  {
    id: 'seo-web-lab',
    name: 'SEO & Web Lab',
    shortName: 'SEO & Web',
    description:
      'Optimiza visibilidad organica, estructura landings y ejecuta experimentos de conversion.',
    accent: 'green',
    room: { col: 0, row: 1 },
    tile: { floor: 'floor-lab', wall: 'wall-lab', palette: 'green' },
  },
  {
    id: 'ad-operations',
    name: 'Advertising Operations',
    shortName: 'Ad Ops',
    description:
      'Define audiencias, reparte presupuesto y controla el ritmo de gasto de las campanas simuladas.',
    accent: 'orange',
    room: { col: 1, row: 1 },
    tile: { floor: 'floor-ops', wall: 'wall-panel', palette: 'orange' },
  },
  {
    id: 'sales-department',
    name: 'Sales Department',
    shortName: 'Sales',
    description:
      'Cualifica leads entrantes, prioriza oportunidades y ejecuta el seguimiento comercial.',
    accent: 'lime',
    room: { col: 2, row: 1 },
    tile: { floor: 'floor-sales', wall: 'wall-panel', palette: 'lime' },
  },
  {
    id: 'analytics-optimization',
    name: 'Analytics & Optimization',
    shortName: 'Analytics',
    description:
      'Mide resultados, detecta desviaciones, propone optimizaciones y consolida aprendizajes.',
    accent: 'blue',
    room: { col: 3, row: 1 },
    tile: { floor: 'floor-lab', wall: 'wall-lab', palette: 'blue' },
  },
];

export const departmentById = new Map(departments.map((department) => [department.id, department]));
