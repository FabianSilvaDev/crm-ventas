/**
 * Catalogo de etapas y definicion de flujos (seccion 9 del prompt).
 *
 * Las 17 etapas se declaran una sola vez en `STAGE_BLUEPRINTS`; los flujos
 * (`workflows`) solo referencian sus `keys`. El simulador ejecuta las etapas en
 * orden de `order`, pero `dependsOn` se conserva para dibujar las dependencias
 * reales entre etapas en la vista de flujo.
 */

export const STAGE_STATUSES = ['pending', 'running', 'completed', 'failed', 'skipped', 'blocked'];

/**
 * Estados de una ejecucion.
 * `awaiting_approval` es una puerta de decision abierta; `rejected` es el final de un
 * ciclo que el operador decidio detener.
 */
export const WORKFLOW_STATUSES = [
  'ready',
  'running',
  'paused',
  'awaiting_approval',
  'completed',
  'failed',
  'rejected',
];

/** Etapas que llevan una puerta de decision declarada. */
export const gatedStageKeys = () =>
  STAGE_BLUEPRINTS.filter((stage) => Boolean(stage.gate)).map((stage) => stage.key);

/** Estados que puede tener una etapa dentro de su catalogo. */
export const STAGE_BLUEPRINTS = [
  {
    key: 'opportunity',
    order: 1,
    name: 'Opportunity',
    summary: 'Detectar y registrar una oportunidad de negocio',
    description:
      'Yanca vigila senales de demanda (tendencias, huecos de catalogo, peticiones de clientes y devoluciones) y registra la oportunidad con su hipotesis, valor esperado y puntuacion, para que el operador decida si entra al flujo.',
    departmentId: 'ops-center',
    agentIds: ['agt-020'],
    dependsOn: [],
    estimatedMinutes: 3,
    deliverables: ['Ficha de oportunidad', 'Puntuacion y valor esperado', 'Criterio de exito'],
    inputs: ['Senales de demanda', 'Objetivos del trimestre', 'Lecciones del ciclo anterior'],
    outcome: {
      summary: 'Oportunidad registrada y priorizada para investigacion.',
      metrics: [
        { label: 'Oportunidades abiertas', value: '6' },
        { label: 'Prioridad asignada', value: 'Alta' },
      ],
      artifacts: [{ type: 'opportunity', id: 'opp-0001', label: 'Perifericos para estudio en casa' }],
    },
  },
  {
    key: 'research',
    order: 2,
    name: 'Research',
    summary: 'Investigar el mercado de la oportunidad',
    description:
      'Dimensionado del mercado, analisis de demanda y revision de fuentes secundarias para descartar oportunidades inviables.',
    departmentId: 'research-lab',
    agentIds: ['agt-002'],
    dependsOn: ['opportunity'],
    estimatedMinutes: 9,
    deliverables: ['Informe de mercado', 'Estimacion TAM/SAM/SOM'],
    inputs: ['Ficha de oportunidad'],
    outcome: {
      summary: 'Mercado dimensionado con demanda estable y estacionalidad marcada.',
      metrics: [
        { label: 'TAM estimado', value: '148 M EUR' },
        { label: 'SAM', value: '22 M EUR' },
        { label: 'SOM a 12 meses', value: '1,4 M EUR' },
      ],
      artifacts: [
        { type: 'research', id: 'rsc-0001', label: 'Informe de mercado: perifericos de estudio' },
      ],
    },
  },
  {
    key: 'market-intelligence',
    order: 3,
    name: 'Market Intelligence',
    summary: 'Convertir la investigacion en inteligencia accionable',
    description:
      'Se cruzan tendencias, estacionalidad y senales de busqueda para decidir el mejor momento y el angulo de entrada.',
    departmentId: 'research-lab',
    agentIds: ['agt-004', 'agt-002'],
    dependsOn: ['research'],
    estimatedMinutes: 7,
    deliverables: ['Mapa de tendencias', 'Ventana de lanzamiento'],
    inputs: ['Informe de mercado'],
    outcome: {
      summary: 'Ventana de lanzamiento identificada en la semana 42 con angulo "estudio en casa".',
      metrics: [
        { label: 'Tendencia principal', value: '+11% T/T' },
        { label: 'Ventana optima', value: 'Semana 42' },
      ],
      artifacts: [{ type: 'research', id: 'rsc-0002', label: 'Mapa de tendencias Q4' }],
    },
  },
  {
    key: 'competitor-analysis',
    order: 4,
    name: 'Competitor Analysis',
    summary: 'Analizar competidores directos e indirectos',
    description:
      'Benchmark de precios, propuesta de valor y posicionamiento de los competidores relevantes del segmento.',
    departmentId: 'research-lab',
    agentIds: ['agt-003'],
    dependsOn: ['research', 'market-intelligence'],
    estimatedMinutes: 8,
    deliverables: ['Matriz competitiva', 'Huecos de posicionamiento'],
    inputs: ['Informe de mercado', 'Mapa de tendencias'],
    outcome: {
      summary: 'Tres competidores dominan el tramo premium; el tramo medio queda sin propuesta de servicio.',
      metrics: [
        { label: 'Competidores analizados', value: '12' },
        { label: 'Precio medio', value: '96 EUR' },
        { label: 'Huecos detectados', value: '3' },
      ],
      artifacts: [{ type: 'research', id: 'rsc-0003', label: 'Matriz competitiva 2026' }],
    },
  },
  {
    key: 'product-validation',
    order: 5,
    name: 'Product Validation',
    summary: 'Validar el producto y su viabilidad economica',
    description:
      'Scoring de oportunidad, estimacion de margen, riesgo de suministro y validacion de la demanda antes de invertir.',
    departmentId: 'research-lab',
    agentIds: ['agt-005'],
    dependsOn: ['competitor-analysis'],
    estimatedMinutes: 12,
    deliverables: ['Score de validacion', 'Estimacion de margen'],
    inputs: ['Matriz competitiva'],
    /**
     * Puerta de decision: el flujo se detiene y pide al operador que decida.
     * Es el punto mas barato para matar una oportunidad, antes de comprometer dinero.
     */
    gate: {
      kind: 'kill',
      question: 'La validacion ha terminado. ¿Seguimos adelante con esta oportunidad?',
      detail:
        'Todavia no se ha comprometido presupuesto ni produccion: es el momento mas barato para descartarla. Si rechazas, la oportunidad se marca como descartada con tu motivo.',
      approveLabel: 'Seguir adelante',
      rejectLabel: 'Descartar oportunidad',
    },
    outcome: {
      summary: 'Producto validado con score 82/100 y margen estimado del 38%.',
      metrics: [
        { label: 'Score', value: '82/100' },
        { label: 'Margen estimado', value: '38%' },
        { label: 'Riesgo de suministro', value: 'Bajo' },
      ],
      artifacts: [{ type: 'product', id: 'prd-001', label: 'Soporte de monitor doble' }],
    },
  },
  {
    key: 'offer-creation',
    order: 6,
    name: 'Offer Creation',
    summary: 'Construir la oferta comercial',
    description:
      'Estructura de niveles, anclaje de precios, garantias y argumentario de compra a partir del producto validado.',
    departmentId: 'marketing-studio',
    agentIds: ['agt-006'],
    dependsOn: ['product-validation'],
    estimatedMinutes: 8,
    deliverables: ['Oferta con niveles', 'Argumentario'],
    inputs: ['Score de validacion'],
    outcome: {
      summary: 'Oferta de tres niveles con anclaje en el nivel medio y ticket objetivo de 129 EUR.',
      metrics: [
        { label: 'Niveles', value: '3' },
        { label: 'Ticket objetivo', value: '129 EUR' },
      ],
      artifacts: [{ type: 'offer', id: 'off-0001', label: 'Setup Estudio Pro' }],
    },
  },
  {
    key: 'content-generation',
    order: 7,
    name: 'Content Generation',
    summary: 'Generar el contenido y el copy de la campana',
    description:
      'Titulares, textos de landing, emails de secuencia, publicaciones sociales y cluster de keywords.',
    departmentId: 'marketing-studio',
    agentIds: ['agt-007', 'agt-009'],
    dependsOn: ['offer-creation'],
    estimatedMinutes: 6,
    deliverables: ['Copys por canal', 'Cluster de keywords'],
    inputs: ['Oferta con niveles'],
    outcome: {
      summary: '18 piezas de contenido generadas con 6 titulares alternativos para test.',
      metrics: [
        { label: 'Piezas', value: '18' },
        { label: 'Keywords objetivo', value: '42' },
        { label: 'CTR del mejor titular', value: '3,8%' },
      ],
      artifacts: [{ type: 'content', id: 'cnt-0001', label: 'Kit de copy: Setup Estudio Pro' }],
    },
  },
  {
    key: 'creative-production',
    order: 8,
    name: 'Creative Production',
    summary: 'Producir las creatividades',
    description:
      'Banners y variantes de formato por dispositivo, revisados contra la guia visual de marca.',
    departmentId: 'creative-studio',
    agentIds: ['agt-011', 'agt-012'],
    dependsOn: ['offer-creation', 'content-generation'],
    estimatedMinutes: 6,
    deliverables: ['Kit de creatividades', 'Variantes por formato'],
    inputs: ['Copys por canal'],
    outcome: {
      summary: '12 variantes de banner entregadas en 3 paletas y 2 composiciones.',
      metrics: [
        { label: 'Formatos', value: '9' },
        { label: 'Variantes', value: '12' },
      ],
      artifacts: [{ type: 'creative', id: 'crv-0001', label: 'Kit Aurora' }],
    },
  },
  {
    key: 'landing-page',
    order: 9,
    name: 'Landing Page',
    summary: 'Publicar la landing y preparar los experimentos',
    description:
      'Estructura de la pagina, formulario optimizado, variantes A/B y verificacion de rendimiento y SEO tecnico.',
    departmentId: 'seo-web-lab',
    agentIds: ['agt-010', 'agt-012'],
    dependsOn: ['content-generation', 'creative-production'],
    estimatedMinutes: 10,
    deliverables: ['Landing publicada', 'Variante B'],
    inputs: ['Kit de copy', 'Kit de creatividades'],
    outcome: {
      summary: 'Landing publicada con dos variantes y formulario reducido a 4 campos.',
      metrics: [
        { label: 'Variantes', value: '2' },
        { label: 'Conversion variante B', value: '3,1%' },
        { label: 'LCP', value: '1,4 s' },
      ],
      artifacts: [{ type: 'landing-page', id: 'lp-0001', label: '/setup-estudio-pro' }],
    },
  },
  {
    key: 'campaign-setup',
    order: 10,
    name: 'Campaign Setup',
    summary: 'Configurar la campana',
    description:
      'Estructura de campana, objetivos, eventos de conversion y calendario de publicacion.',
    departmentId: 'ad-operations',
    agentIds: ['agt-013', 'agt-001'],
    dependsOn: ['landing-page', 'offer-creation'],
    estimatedMinutes: 7,
    deliverables: ['Campana configurada', 'Plan de publicacion'],
    inputs: ['Landing publicada'],
    gate: {
      kind: 'launch',
      question: '¿Publicamos la campana?',
      detail:
        'Es el ultimo control antes de salir al mercado: al publicar, la campana empieza a captar leads reales.',
      approveLabel: 'Publicar campana',
      rejectLabel: 'No publicar',
    },
    outcome: {
      summary: 'Campana "Vuelta a la oficina" configurada en 3 canales simulados.',
      metrics: [
        { label: 'Canales', value: '3' },
        { label: 'Grupos de anuncios', value: '9' },
      ],
      artifacts: [{ type: 'campaign', id: 'cmp-0001', label: 'Vuelta a la oficina' }],
    },
  },
  {
    key: 'audience-budget',
    order: 11,
    name: 'Audience & Budget',
    summary: 'Definir audiencias y presupuesto',
    description:
      'Segmentacion, exclusiones, reparto de presupuesto por canal y limites de puja.',
    departmentId: 'ad-operations',
    agentIds: ['agt-013', 'agt-014'],
    dependsOn: ['campaign-setup'],
    estimatedMinutes: 9,
    deliverables: ['Audiencias', 'Reparto de presupuesto'],
    inputs: ['Campana configurada'],
    gate: {
      kind: 'budget',
      question: '¿Autorizas el reparto de presupuesto de esta campana?',
      detail:
        'A partir de aqui la campana empieza a gastar. Revisa el reparto por canal antes de autorizarlo: si rechazas, el ciclo se detiene aqui.',
      approveLabel: 'Autorizar presupuesto',
      rejectLabel: 'No autorizar',
    },
    outcome: {
      summary: '4 audiencias activas con 6.400 EUR repartidos entre busqueda, social y display.',
      metrics: [
        { label: 'Audiencias', value: '4' },
        { label: 'Presupuesto', value: '6.400 EUR' },
        { label: 'CPC objetivo', value: '0,62 EUR' },
      ],
      artifacts: [{ type: 'campaign', id: 'cmp-0001', label: 'Vuelta a la oficina' }],
    },
  },
  {
    key: 'lead-acquisition',
    order: 12,
    name: 'Lead Acquisition',
    summary: 'Captar leads',
    description:
      'Entrada de leads desde campana, organico y referidos, con deduplicacion y trazas de origen.',
    departmentId: 'ad-operations',
    agentIds: ['agt-013'],
    dependsOn: ['audience-budget'],
    estimatedMinutes: 11,
    deliverables: ['Leads captados', 'Trazabilidad de origen'],
    inputs: ['Audiencias', 'Reparto de presupuesto'],
    outcome: {
      summary: '146 leads captados en el primer ciclo con coste por lead de 8,40 EUR.',
      metrics: [
        { label: 'Leads', value: '146' },
        { label: 'CPL', value: '8,40 EUR' },
        { label: 'Origen principal', value: 'Busqueda (38%)' },
      ],
      artifacts: [{ type: 'lead', id: 'led-0001', label: 'Lote de leads del ciclo 12' }],
    },
  },
  {
    key: 'lead-qualification',
    order: 13,
    name: 'Lead Qualification',
    summary: 'Cualificar y priorizar los leads',
    description:
      'Scoring, criterios BANT, deteccion de duplicados y paso a seguimiento comercial.',
    departmentId: 'sales-department',
    agentIds: ['agt-015'],
    dependsOn: ['lead-acquisition'],
    estimatedMinutes: 4,
    deliverables: ['Leads cualificados', 'Priorizacion'],
    inputs: ['Leads captados'],
    outcome: {
      summary: '60 de 146 leads cualificados (41%) y priorizados por intencion y tamano.',
      metrics: [
        { label: 'Cualificados', value: '60' },
        { label: 'Tasa', value: '41%' },
        { label: 'Duplicados', value: '9' },
      ],
      artifacts: [{ type: 'lead', id: 'led-0012', label: 'Leads cualificados del ciclo 12' }],
    },
  },
  {
    key: 'sales-follow-up',
    order: 14,
    name: 'Sales Follow-up',
    summary: 'Ejecutar el seguimiento comercial',
    description:
      'Secuencias de contacto, manejo de objeciones, envio de propuestas y cierre.',
    departmentId: 'sales-department',
    agentIds: ['agt-016'],
    dependsOn: ['lead-qualification'],
    estimatedMinutes: 6,
    deliverables: ['Secuencias ejecutadas', 'Propuestas enviadas'],
    inputs: ['Leads cualificados'],
    outcome: {
      summary: '24 propuestas enviadas y 11 cierres simulados por valor de 9.880 EUR.',
      metrics: [
        { label: 'Propuestas', value: '24' },
        { label: 'Cierres', value: '11' },
        { label: 'Valor cerrado', value: '9.880 EUR' },
      ],
      artifacts: [{ type: 'lead', id: 'led-0033', label: 'Oportunidades en seguimiento' }],
    },
  },
  {
    key: 'analytics',
    order: 15,
    name: 'Analytics',
    summary: 'Medir el resultado del ciclo',
    description:
      'Consolidacion de metricas, atribucion por canal y deteccion de desviaciones frente al objetivo.',
    departmentId: 'analytics-optimization',
    agentIds: ['agt-017'],
    dependsOn: ['lead-acquisition', 'sales-follow-up'],
    estimatedMinutes: 8,
    deliverables: ['Cuadro de mando', 'Informe de atribucion'],
    inputs: ['Leads captados', 'Propuestas enviadas'],
    outcome: {
      summary: 'El canal organico aporta el 38% de las conversiones con el 12% del gasto.',
      metrics: [
        { label: 'Conversiones', value: '146' },
        { label: 'ROAS simulado', value: '3,4x' },
        { label: 'Coste por conversion', value: '14,20 EUR' },
      ],
      artifacts: [{ type: 'analytics', id: 'anl-0001', label: 'Informe semanal consolidado' }],
    },
  },
  {
    key: 'optimization',
    order: 16,
    name: 'Optimization',
    summary: 'Aplicar optimizaciones',
    description:
      'Hipotesis priorizadas, ajustes de puja, cambios en landing y redistribucion de presupuesto.',
    departmentId: 'analytics-optimization',
    agentIds: ['agt-018'],
    dependsOn: ['analytics'],
    estimatedMinutes: 9,
    deliverables: ['Plan de optimizacion', 'Experimentos activos'],
    inputs: ['Informe de atribucion'],
    outcome: {
      summary: '7 hipotesis priorizadas; el formulario corto eleva la conversion del 2,1% al 2,6%.',
      metrics: [
        { label: 'Hipotesis', value: '7' },
        { label: 'Conversion', value: '2,6%' },
        { label: 'Ahorro en pujas', value: '9%' },
      ],
      artifacts: [{ type: 'analytics', id: 'anl-0002', label: 'Plan de optimizacion Q4' }],
    },
  },
  {
    key: 'learning',
    order: 17,
    name: 'Learning',
    summary: 'Consolidar aprendizajes del ciclo',
    description:
      'Se guardan patrones y lecciones en la base de conocimiento para que el siguiente ciclo empiece con ventaja.',
    departmentId: 'analytics-optimization',
    agentIds: ['agt-019'],
    dependsOn: ['optimization', 'sales-follow-up'],
    estimatedMinutes: 5,
    deliverables: ['Lecciones aprendidas', 'Patrones reutilizables'],
    inputs: ['Plan de optimizacion'],
    outcome: {
      summary: '9 lecciones guardadas; el patron de margen > 35% predice validacion en el 78% de los casos.',
      metrics: [
        { label: 'Lecciones', value: '9' },
        { label: 'Patrones nuevos', value: '4' },
      ],
      artifacts: [{ type: 'learning', id: 'lrn-0001', label: 'Lecciones del ciclo 12' }],
    },
  },
];

export const stageByKey = new Map(STAGE_BLUEPRINTS.map((stage) => [stage.key, stage]));

/**
 * Etapas en las que un fallo simulado es verosimil (limites de presupuesto, entrega
 * de trafico, publicacion). El resto de etapas no fallan nunca: asi el ciclo
 * completo puede terminar de verdad y el manejo de errores se demuestra en un punto
 * creible en lugar de bloquear cualquier demostracion.
 */
export const FAILURE_PRONE_STAGES = new Set([
  'competitor-analysis',
  'landing-page',
  'campaign-setup',
  'audience-budget',
  'lead-acquisition',
  'analytics',
]);

/** Motivos de fallo por etapa, para que el error simulado tenga sentido. */
export const STAGE_FAILURE_REASONS = {
  'competitor-analysis': 'El proveedor de datos externo no responde; el benchmark queda incompleto.',
  'landing-page': 'La verificacion de rendimiento no alcanza el minimo configurado (LCP > 2,5 s).',
  'campaign-setup': 'La plataforma publicitaria rechaza la estructura de la campana simulada.',
  'audience-budget': 'El presupuesto solicitado excede el limite configurado para el canal.',
  'lead-acquisition': 'El volumen de captacion queda por debajo del minimo del periodo simulado.',
  analytics: 'La ventana de atribucion solicitada no tiene datos suficientes para calcular el informe.',
};

/** Flujos disponibles. Cada uno es una secuencia de claves del catalogo de etapas. */
export const workflows = [
  {
    id: 'wf-full-cycle',
    name: 'Ciclo completo: oportunidad a aprendizaje',
    description:
      'Recorre las 17 etapas del sistema, desde la deteccion de la oportunidad hasta la consolidacion de aprendizajes.',
    goal: 'Ejecutar un ciclo comercial completo de demostracion.',
    ownerAgentId: 'agt-001',
    tags: ['end-to-end', 'demostracion'],
    estimatedMinutes: STAGE_BLUEPRINTS.reduce((total, stage) => total + stage.estimatedMinutes, 0),
    runsCompleted: 12,
    successRate: 0.83,
    stageKeys: STAGE_BLUEPRINTS.map((stage) => stage.key),
  },
  {
    id: 'wf-market-research',
    name: 'Investigacion de mercado',
    description:
      'Valida una oportunidad antes de invertir: mercado, inteligencia, competencia y validacion de producto.',
    goal: 'Decidir si una oportunidad merece pasar a oferta.',
    ownerAgentId: 'agt-002',
    tags: ['research', 'validacion'],
    estimatedMinutes: 36,
    runsCompleted: 31,
    successRate: 0.9,
    stageKeys: ['research', 'market-intelligence', 'competitor-analysis', 'product-validation'],
  },
  {
    id: 'wf-launch-campaign',
    name: 'Lanzamiento de campana',
    description:
      'Convierte un producto validado en una campana activa con contenido, creatividades, landing y captacion.',
    goal: 'Poner una campana en marcha de principio a fin.',
    ownerAgentId: 'agt-013',
    tags: ['marketing', 'campanas'],
    estimatedMinutes: 56,
    runsCompleted: 19,
    successRate: 0.87,
    stageKeys: [
      'offer-creation',
      'content-generation',
      'creative-production',
      'landing-page',
      'campaign-setup',
      'audience-budget',
      'lead-acquisition',
    ],
  },
  {
    id: 'wf-sales-loop',
    name: 'Ciclo de ventas y mejora',
    description:
      'Cualifica los leads captados, ejecuta el seguimiento, mide y consolida aprendizajes.',
    goal: 'Mejorar el embudo de conversion ciclo a ciclo.',
    ownerAgentId: 'agt-016',
    tags: ['ventas', 'optimizacion'],
    estimatedMinutes: 32,
    runsCompleted: 24,
    successRate: 0.85,
    stageKeys: [
      'lead-acquisition',
      'lead-qualification',
      'sales-follow-up',
      'analytics',
      'optimization',
      'learning',
    ],
  },
];

export const workflowById = new Map(workflows.map((workflow) => [workflow.id, workflow]));

/** Devuelve las etapas de un flujo, en orden, con su blueprint completo. */
export const stagesOf = (workflow) =>
  workflow.stageKeys.map((key) => stageByKey.get(key)).filter(Boolean);
