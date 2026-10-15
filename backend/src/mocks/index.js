/**
 * Punto unico de acceso a los datos simulados.
 * Los servicios importan desde aqui para que sustituir los mocks por una fuente
 * real no obligue a tocar cada modulo.
 */
export { agents, agentById, AGENT_STATUSES } from './agents.js';
export { departments, departmentById, OFFICE_GRID } from './departments.js';
export {
  FAILURE_PRONE_STAGES,
  STAGE_BLUEPRINTS,
  STAGE_FAILURE_REASONS,
  STAGE_STATUSES,
  WORKFLOW_STATUSES,
  stageByKey,
  stagesOf,
  workflowById,
  workflows,
} from './workflow.js';
export { products, offers, productById, offerById, PRODUCT_STATUSES, OFFER_STATUSES } from './products.js';
export { campaigns, campaignById, deriveMetrics, CAMPAIGN_STATUSES } from './campaigns.js';
export { leads, LEAD_ORIGINS, LEAD_STATUSES } from './leads.js';
export {
  contentPieces,
  creatives,
  contentById,
  creativeById,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  CREATIVE_FORMATS,
} from './content.js';
export { landingPages, landingPageById, LANDING_STATUSES } from './landing-pages.js';
export { researchReports, researchById, RESEARCH_TYPES } from './research.js';
export { activityEvents, notifications } from './activity.js';
export { settings } from './settings.js';
