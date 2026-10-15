/**
 * Tabla de rutas de la API v1.
 *
 * Las rutas se agrupan por recurso en un unico fichero para que la superficie
 * completa de la API se pueda leer de una vez (ver docs/api.md). Los manejadores
 * son finos: validan la entrada y delegan en los servicios.
 *
 * IMPORTANTE (Express 5): las rutas literales se declaran ANTES que las rutas con
 * parametro (`/products/highlights` antes de `/products/:id`) y no se usan wildcards
 * sueltos, porque Express 5 cambio el analizador de rutas.
 */
import { Router } from 'express';
import * as activity from '../controllers/activity.controller.js';
import * as agents from '../controllers/agents.controller.js';
import * as analytics from '../controllers/analytics.controller.js';
import * as campaigns from '../controllers/campaigns.controller.js';
import * as content from '../controllers/content.controller.js';
import * as dashboard from '../controllers/dashboard.controller.js';
import * as departments from '../controllers/departments.controller.js';
import * as health from '../controllers/health.controller.js';
import * as intake from '../controllers/intake.controller.js';
import * as landingPages from '../controllers/landing-pages.controller.js';
import * as leads from '../controllers/leads.controller.js';
import * as opportunities from '../controllers/opportunities.controller.js';
import * as products from '../controllers/products.controller.js';
import * as research from '../controllers/research.controller.js';
import * as settings from '../controllers/settings.controller.js';
import * as workflows from '../controllers/workflows.controller.js';

// --- Health -----------------------------------------------------------------
const healthRouter = Router();
healthRouter.get('/', health.getHealth);

// --- Dashboard --------------------------------------------------------------
const dashboardRouter = Router();
dashboardRouter.get('/', dashboard.readDashboard);

// --- Agents -----------------------------------------------------------------
const agentsRouter = Router();
agentsRouter.get('/', agents.readAgents);
agentsRouter.get('/summary', agents.readAgentSummary);
agentsRouter.get('/search', agents.searchAgents);
agentsRouter.get('/tasks', agents.readAgentTasks);
agentsRouter.get('/tasks/:taskId', agents.readAgentTask);
agentsRouter.get('/:id', agents.readAgent);
agentsRouter.post('/:id/run', agents.runAgent);

// --- Departments ------------------------------------------------------------
const departmentsRouter = Router();
departmentsRouter.get('/', departments.readDepartments);
departmentsRouter.get('/:id', departments.readDepartment);

// --- Workflows --------------------------------------------------------------
const workflowsRouter = Router();
workflowsRouter.get('/', workflows.readWorkflows);
workflowsRouter.get('/stages', workflows.readStageCatalog);
workflowsRouter.get('/runs', workflows.readRuns);
workflowsRouter.get('/runs/:runId', workflows.readRun);
workflowsRouter.post('/runs/:runId/pause', workflows.pauseRunById);
workflowsRouter.post('/runs/:runId/resume', workflows.resumeRunById);
workflowsRouter.post('/runs/:runId/reset', workflows.resetRunById);
workflowsRouter.post('/runs/:runId/approve', workflows.approveRunById);
workflowsRouter.post('/runs/:runId/reject', workflows.rejectRunById);
workflowsRouter.get('/:id', workflows.readWorkflow);
workflowsRouter.post('/:id/run', workflows.startRun);

// --- Products y ofertas -----------------------------------------------------
const productsRouter = Router();
productsRouter.get('/', products.readProducts);
productsRouter.get('/highlights', products.readProductHighlights);
productsRouter.get('/:id', products.readProduct);

const offersRouter = Router();
offersRouter.get('/', products.readOffers);
offersRouter.get('/:id', products.readOffer);

// --- Campaigns --------------------------------------------------------------
const campaignsRouter = Router();
campaignsRouter.get('/', campaigns.readCampaigns);
campaignsRouter.get('/summary', campaigns.readCampaignSummary);
campaignsRouter.get('/:id', campaigns.readCampaign);

// --- Leads ------------------------------------------------------------------
const leadsRouter = Router();
leadsRouter.get('/', leads.readLeads);
leadsRouter.get('/summary', leads.readLeadsSummary);
leadsRouter.get('/:id', leads.readLead);

// --- Contenido y creatividades ---------------------------------------------
const contentRouter = Router();
contentRouter.get('/', content.readContent);
contentRouter.get('/summary', content.readContentSummary);
contentRouter.get('/:id', content.readContentItem);

const creativesRouter = Router();
creativesRouter.get('/', content.readCreatives);
creativesRouter.get('/:id', content.readCreative);

// --- Landing pages ----------------------------------------------------------
const landingPagesRouter = Router();
landingPagesRouter.get('/', landingPages.readLandingPages);
landingPagesRouter.get('/summary', landingPages.readLandingSummary);
landingPagesRouter.get('/:id', landingPages.readLandingPageById);

// --- Investigacion ----------------------------------------------------------
const researchRouter = Router();
researchRouter.get('/', research.readResearch);
researchRouter.get('/summary', research.readResearchSummary);
researchRouter.get('/:id', research.readResearchById);

// --- Analitica --------------------------------------------------------------
const analyticsRouter = Router();
analyticsRouter.get('/', analytics.readAnalytics);

// --- Estudio de oportunidad y cola de oportunidades ------------------------
const sourcesRouter = Router();
sourcesRouter.get('/', intake.readSources);

const intakeRouter = Router();
intakeRouter.post('/scan', intake.runScan);
intakeRouter.get('/discover', opportunities.discover);

const opportunitiesRouter = Router();
opportunitiesRouter.get('/', opportunities.readOpportunities);
opportunitiesRouter.get('/summary', opportunities.readOpportunitySummary);
opportunitiesRouter.get('/:id', opportunities.readOpportunity);
opportunitiesRouter.post('/:id/approve', opportunities.approve);
opportunitiesRouter.post('/:id/discard', opportunities.discard);
opportunitiesRouter.post('/:id/run', opportunities.launch);

// --- Actividad y notificaciones --------------------------------------------
const activityRouter = Router();
activityRouter.get('/', activity.readActivity);
activityRouter.get('/types', activity.readActivityTypes);

const notificationsRouter = Router();
notificationsRouter.get('/', activity.readNotifications);
notificationsRouter.post('/read-all', activity.markAllRead);
notificationsRouter.post('/:id/read', activity.markRead);

// --- Configuracion ----------------------------------------------------------
const settingsRouter = Router();
settingsRouter.get('/', settings.readSettings);

/** Router raiz de /api/v1. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/agents', agentsRouter);
apiRouter.use('/departments', departmentsRouter);
apiRouter.use('/workflows', workflowsRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/offers', offersRouter);
apiRouter.use('/campaigns', campaignsRouter);
apiRouter.use('/leads', leadsRouter);
apiRouter.use('/content', contentRouter);
apiRouter.use('/creatives', creativesRouter);
apiRouter.use('/landing-pages', landingPagesRouter);
apiRouter.use('/research', researchRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/sources', sourcesRouter);
apiRouter.use('/intake', intakeRouter);
apiRouter.use('/opportunities', opportunitiesRouter);
apiRouter.use('/activity', activityRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/settings', settingsRouter);

/** Indice de la API: util para descubrir los recursos disponibles. */
export const describeApi = () => ({
  name: 'AI Operations CMS API',
  version: 'v1',
  demo: true,
  prefix: '/api/v1',
  resources: [
    { path: '/api/v1/health', description: 'Estado del servicio y de la simulacion' },
    { path: '/api/v1/dashboard', description: 'Indicadores agregados de la operacion' },
    { path: '/api/v1/agents', description: 'Agentes, tareas simuladas y su estado' },
    { path: '/api/v1/departments', description: 'Departamentos y su carga de trabajo' },
    { path: '/api/v1/workflows', description: 'Flujos, catalogo de etapas y ejecuciones' },
    { path: '/api/v1/products', description: 'Productos investigados' },
    { path: '/api/v1/offers', description: 'Ofertas derivadas de los productos' },
    { path: '/api/v1/campaigns', description: 'Campanas simuladas y sus metricas' },
    { path: '/api/v1/leads', description: 'Leads y embudo comercial' },
    { path: '/api/v1/content', description: 'Piezas de contenido' },
    { path: '/api/v1/creatives', description: 'Creatividades y formatos' },
    { path: '/api/v1/landing-pages', description: 'Landings y experimentos A/B' },
    { path: '/api/v1/research', description: 'Informes de investigacion de mercado' },
    { path: '/api/v1/sources', description: 'Fuentes de datos del estudio de oportunidad y su estado' },
    { path: '/api/v1/intake/scan', description: 'Estudio de oportunidad: señales con fuente y candidatas registradas' },
    { path: '/api/v1/intake/discover', description: 'Terminos que estan subiendo ahora (Google Trends)' },
    { path: '/api/v1/opportunities', description: 'Cola de oportunidades y decision del operador' },
    { path: '/api/v1/analytics', description: 'Analitica agregada' },
    { path: '/api/v1/activity', description: 'Actividad reciente' },
    { path: '/api/v1/notifications', description: 'Notificaciones simuladas' },
    { path: '/api/v1/settings', description: 'Configuracion del workspace' },
  ],
});
