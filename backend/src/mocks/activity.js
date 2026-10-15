/**
 * Actividad reciente y notificaciones simuladas que alimentan el dashboard y el header.
 * Los eventos son historicos (feed inicial); el servidor anade nuevos al ejecutar
 * tareas y flujos.
 */
import { isoMinutesAgo, makeId } from '../utils/time.js';

const event = (index, data) => ({
  id: makeId('evt', index + 1),
  at: isoMinutesAgo(data.minutesAgo),
  ...data,
});

export const activityEvents = [
  event(0, { minutesAgo: 1, type: 'opportunity_registered', severity: 'success', actorAgentId: 'agt-020', departmentId: 'ops-center', message: 'Yanca registra 4 oportunidades de las 23 senales revisadas y las deja en la cola de decisiones.', refs: [{ type: 'opportunity', id: 'opp-0001', label: 'Perifericos para estudio en casa' }] }),
  event(1, { minutesAgo: 1, type: 'task_started', severity: 'info', actorAgentId: 'agt-015', departmentId: 'sales-department', message: 'QUALIFY empieza a cualificar el lote de 18 leads de la manana.', refs: [{ type: 'lead', id: 'led-0012', label: 'Lote 41' }] }),
  event(2, { minutesAgo: 2, type: 'collaboration', severity: 'info', actorAgentId: 'agt-012', departmentId: 'creative-studio', message: 'LUMEN revisa la coherencia visual de 12 variantes de banner.', refs: [{ type: 'creative', id: 'crv-0004', label: 'Kit Aurora' }] }),
  event(3, { minutesAgo: 3, type: 'task_started', severity: 'info', actorAgentId: 'agt-011', departmentId: 'creative-studio', message: 'PIXEL genera 12 variantes de banner para la campana Aurora.', refs: [{ type: 'campaign', id: 'cmp-0002', label: 'Aurora Pro' }] }),
  event(4, { minutesAgo: 5, type: 'task_started', severity: 'info', actorAgentId: 'agt-013', departmentId: 'ad-operations', message: 'TARGET construye 4 audiencias para la campana de otono.', refs: [{ type: 'campaign', id: 'cmp-0001', label: 'Vuelta a la oficina' }] }),
  event(5, { minutesAgo: 6, type: 'metric', severity: 'success', actorAgentId: 'agt-017', departmentId: 'analytics-optimization', message: 'METRIC recalcula la atribucion: el organico aporta el 38% de las conversiones.', refs: [{ type: 'analytics', id: 'anl-0001', label: 'Informe semanal' }] }),
  event(6, { minutesAgo: 8, type: 'task_started', severity: 'info', actorAgentId: 'agt-003', departmentId: 'research-lab', message: 'VECTOR completa el benchmark de precios de 12 marcas de referencia.', refs: [{ type: 'research', id: 'rsc-0003', label: 'Matriz competitiva' }] }),
  event(7, { minutesAgo: 12, type: 'task_failed', severity: 'error', actorAgentId: 'agt-014', departmentId: 'ad-operations', message: 'BUDGET no puede recalcular el reparto: el presupuesto excede el limite del canal.', refs: [{ type: 'campaign', id: 'cmp-0003', label: 'Norte Ergo Q4' }] }),
  event(8, { minutesAgo: 14, type: 'content_published', severity: 'success', actorAgentId: 'agt-009', departmentId: 'seo-web-lab', message: 'RANK publica la guia de luz de trabajo y actualiza el cluster de keywords.', refs: [{ type: 'content', id: 'cnt-0008', label: 'Guia de luz de trabajo' }] }),
  event(9, { minutesAgo: 17, type: 'task_completed', severity: 'success', actorAgentId: 'agt-005', departmentId: 'research-lab', message: 'FORGE valida el soporte de monitor doble con score 82/100.', refs: [{ type: 'product', id: 'prd-001', label: 'Soporte de monitor doble' }] }),
  event(10, { minutesAgo: 19, type: 'lead_qualified', severity: 'success', actorAgentId: 'agt-015', departmentId: 'sales-department', message: '9 leads del lote 41 pasan a seguimiento comercial.', refs: [{ type: 'lead', id: 'led-0012', label: 'Leads cualificados' }] }),
  event(11, { minutesAgo: 21, type: 'task_completed', severity: 'success', actorAgentId: 'agt-016', departmentId: 'sales-department', message: 'CLOSER cierra la oportunidad de Estudio Noroeste por 1.240 EUR.', refs: [{ type: 'lead', id: 'led-0001', label: 'Estudio Noroeste' }] }),
  event(12, { minutesAgo: 26, type: 'optimization', severity: 'info', actorAgentId: 'agt-018', departmentId: 'analytics-optimization', message: 'TUNE prioriza 7 hipotesis de mejora del embudo de pago.', refs: [{ type: 'analytics', id: 'anl-0002', label: 'Plan de optimizacion' }] }),
  event(13, { minutesAgo: 31, type: 'content_published', severity: 'success', actorAgentId: 'agt-010', departmentId: 'seo-web-lab', message: 'PAGES publica la variante B de la landing de Setup Estudio Pro.', refs: [{ type: 'landing-page', id: 'lp-0001', label: '/setup-estudio-pro' }] }),
  event(14, { minutesAgo: 34, type: 'workflow_stage', severity: 'success', actorAgentId: 'agt-020', departmentId: 'ops-center', message: 'Yanca registra la oportunidad de perifericos de estudio con puntuacion 78/100.', refs: [{ type: 'opportunity', id: 'opp-0001', label: 'Perifericos para estudio en casa' }] }),
  event(15, { minutesAgo: 39, type: 'task_started', severity: 'info', actorAgentId: 'agt-006', departmentId: 'marketing-studio', message: 'QUOTE reescala la oferta Setup Estudio Pro a tres niveles.', refs: [{ type: 'offer', id: 'off-0001', label: 'Setup Estudio Pro' }] }),
  event(16, { minutesAgo: 44, type: 'task_completed', severity: 'success', actorAgentId: 'agt-007', departmentId: 'marketing-studio', message: 'QUILL entrega 6 titulares A/B para la landing de monitores.', refs: [{ type: 'content', id: 'cnt-0002', label: 'Titulares A/B' }] }),
  event(17, { minutesAgo: 52, type: 'task_completed', severity: 'success', actorAgentId: 'agt-002', departmentId: 'research-lab', message: 'SCOUT cierra el informe de mercado de escritorios regulables.', refs: [{ type: 'research', id: 'rsc-0005', label: 'Informe de mercado' }] }),
  event(18, { minutesAgo: 58, type: 'task_started', severity: 'info', actorAgentId: 'agt-004', departmentId: 'research-lab', message: 'PULSE cruza tendencias de busqueda con el calendario de campanas.', refs: [{ type: 'research', id: 'rsc-0002', label: 'Mapa de tendencias' }] }),
  event(19, { minutesAgo: 63, type: 'budget', severity: 'warning', actorAgentId: 'agt-014', departmentId: 'ad-operations', message: 'El ritmo de gasto de Norte Ergo Q4 supera el plan diario en un 8%.', refs: [{ type: 'campaign', id: 'cmp-0003', label: 'Norte Ergo Q4' }] }),
  event(20, { minutesAgo: 71, type: 'task_completed', severity: 'success', actorAgentId: 'agt-008', departmentId: 'marketing-studio', message: 'SOCIAL programa 14 publicaciones para la semana 41.', refs: [] }),
  event(21, { minutesAgo: 84, type: 'task_completed', severity: 'success', actorAgentId: 'agt-012', departmentId: 'creative-studio', message: 'LUMEN consolida la guia visual v3 con una paleta de 6 colores.', refs: [{ type: 'creative', id: 'crv-0009', label: 'Guia visual v3' }] }),
  event(22, { minutesAgo: 96, type: 'task_failed', severity: 'error', actorAgentId: 'agt-019', departmentId: 'analytics-optimization', message: 'LEARN esta fuera de linea; los aprendizajes del ciclo 12 quedan en cola.', refs: [{ type: 'learning', id: 'lrn-0001', label: 'Lecciones del ciclo 12' }] }),
  event(23, { minutesAgo: 108, type: 'lead_qualified', severity: 'success', actorAgentId: 'agt-015', departmentId: 'sales-department', message: 'Se marcan 3 leads como duplicado en el lote 40.', refs: [] }),
  event(24, { minutesAgo: 126, type: 'workflow_stage', severity: 'info', actorAgentId: 'agt-001', departmentId: 'ops-center', message: 'NEXUS reorganiza el flujo de campana tras el fallo de presupuesto.', refs: [{ type: 'workflow', id: 'wf-launch-campaign', label: 'Lanzamiento de campana' }] }),
  event(25, { minutesAgo: 141, type: 'optimization', severity: 'success', actorAgentId: 'agt-018', departmentId: 'analytics-optimization', message: 'El formulario corto eleva la conversion del 2,1% al 2,6%.', refs: [{ type: 'landing-page', id: 'lp-0001', label: '/setup-estudio-pro' }] }),
  event(26, { minutesAgo: 165, type: 'task_completed', severity: 'success', actorAgentId: 'agt-009', departmentId: 'seo-web-lab', message: 'RANK aplica 18 correcciones de SEO tecnico al sitio.', refs: [{ type: 'landing-page', id: 'lp-0004', label: '/halo-focus' }] }),
];

export const notifications = [
  {
    id: 'ntf-0001',
    title: 'Presupuesto excedido en Norte Ergo Q4',
    message:
      'El reparto solicitado supera el limite configurado del canal. BUDGET ha detenido el recalculo.',
    level: 'error',
    at: isoMinutesAgo(12),
    read: false,
    link: '/campaigns',
    linkLabel: 'Ver campanas',
  },
  {
    id: 'ntf-0002',
    title: 'Etapa lista para revisar',
    message: 'La etapa Landing Page del ciclo completo ha terminado con dos variantes publicadas.',
    level: 'success',
    at: isoMinutesAgo(31),
    read: false,
    link: '/workflows',
    linkLabel: 'Abrir flujo',
  },
  {
    id: 'ntf-0003',
    title: 'LEARN fuera de linea',
    message: 'El agente de consolidacion de aprendizajes no responde desde hace 3 horas.',
    level: 'warning',
    at: isoMinutesAgo(190),
    read: false,
    link: '/agents',
    linkLabel: 'Ver agentes',
  },
  {
    id: 'ntf-0004',
    title: 'Producto validado',
    message: 'FORGE ha validado la lampara Halo Focus con score 77/100 y margen del 44%.',
    level: 'success',
    at: isoMinutesAgo(420),
    read: true,
    link: '/products',
    linkLabel: 'Ver producto',
  },
  {
    id: 'ntf-0005',
    title: 'Lote de leads cualificado',
    message: '41 de los 146 leads captados pasan a seguimiento comercial.',
    level: 'info',
    at: isoMinutesAgo(600),
    read: true,
    link: '/leads',
    linkLabel: 'Ver leads',
  },
  {
    id: 'ntf-0006',
    title: 'Experimento ganador',
    message: 'La variante B de /setup-estudio-pro supera a la A en un 13,7% de conversion.',
    level: 'info',
    at: isoMinutesAgo(880),
    read: true,
    link: '/landing-pages',
    linkLabel: 'Ver landings',
  },
];
