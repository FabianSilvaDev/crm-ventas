/**
 * Configuracion simulada del CMS. Nada de esto conecta con servicios reales:
 * las integraciones aparecen como deshabilitadas o simuladas a proposito.
 */
import { config } from '../config.js';
import { isoMinutesAgo } from '../utils/time.js';

export const settings = {
  workspace: {
    id: 'ws-demo-001',
    name: 'AI Operations CMS',
    plan: 'Demostracion',
    timezone: 'Europe/Madrid',
    locale: 'es-ES',
    currency: 'EUR',
    demo: true,
  },
  profile: {
    id: 'usr-demo-001',
    name: 'Operadora de demostracion',
    role: 'Supervisora de operaciones',
    email: 'operaciones@ai-operations.demo.test',
    initials: 'OD',
    avatar: { body: 'a', palette: 'cyan', hair: 'dark', skin: 'medium', accessory: 'headset' },
    lastLoginAt: isoMinutesAgo(64),
  },
  simulation: {
    stepMs: config.simulation.stepMs,
    taskMs: config.simulation.taskMs,
    tickMs: config.simulation.tickMs,
    failureRate: config.simulation.failureRate,
    maxRuns: config.simulation.maxRuns,
    pollIntervalMs: config.pollIntervalMs,
  },
  dataPolicy: {
    inMemory: true,
    persistent: false,
    note: 'Los datos y las ejecuciones viven en memoria: se pierden al reiniciar el servidor.',
  },
  integrations: [
    {
      id: 'int-llm',
      name: 'Proveedor de modelos',
      category: 'IA',
      status: 'disabled',
      description: 'Sustituira a los resultados simulados de los agentes cuando se conecte un modelo real.',
    },
    {
      id: 'int-ads',
      name: 'Plataformas publicitarias',
      category: 'Publicidad',
      status: 'disabled',
      description: 'Sincronizaria campanas, presupuestos y metricas reales de las plataformas de anuncios.',
    },
    {
      id: 'int-crm',
      name: 'CRM externo',
      category: 'Ventas',
      status: 'disabled',
      description: 'Enviaria leads cualificados y recibiria el estado de las oportunidades.',
    },
    {
      id: 'int-analytics',
      name: 'Analitica web',
      category: 'Analitica',
      status: 'simulated',
      description: 'Los datos de trafico de las landings se generan de forma determinista dentro del backend.',
    },
    {
      id: 'int-email',
      name: 'Envio de correo',
      category: 'Marketing',
      status: 'simulated',
      description: 'Las secuencias de email se registran como eventos, sin enviar correo real.',
    },
    {
      id: 'int-storage',
      name: 'Base de datos',
      category: 'Infraestructura',
      status: 'disabled',
      description: 'Esta version guarda los datos en memoria; no hay base de datos ni ficheros persistentes.',
    },
  ],
  featureFlags: [
    { id: 'flag-office', name: 'Oficina virtual pixel art', enabled: true, description: 'Escenario 2D con los agentes por departamento.' },
    { id: 'flag-simulation', name: 'Simulacion de flujos', enabled: true, description: 'Avance de etapas en segundo plano con pausa, reanudacion y reinicio.' },
    { id: 'flag-failures', name: 'Errores simulados', enabled: config.simulation.failureRate > 0, description: 'Introduce fallos controlados para probar el manejo de errores.' },
    { id: 'flag-real-agents', name: 'Agentes reales', enabled: false, description: 'Reservado: sustituira los resultados mock por llamadas a un modelo.' },
    { id: 'flag-billing', name: 'Facturacion', enabled: false, description: 'No implementado en la version de demostracion.' },
  ],
};
