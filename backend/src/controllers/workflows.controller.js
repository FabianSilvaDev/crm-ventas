/** Flujos: catalogo, detalle, ejecucion simulada y control de ejecuciones. */
import { WORKFLOW_STATUSES } from '../mocks/index.js';
import { getStageCatalog, getWorkflow, getWorkflowOrThrow, listWorkflows } from '../services/workflows.service.js';
import {
  approveRun,
  createRun,
  getRun,
  listRuns,
  pauseRun,
  rejectRun,
  resetRun,
  resumeRun,
  serializeRun,
} from '../services/workflow-simulator.js';
import { accepted, asyncHandler, ok, paginated } from '../utils/http.js';
import { parseEnum, parsePagination, requireString } from '../utils/validate.js';
import { buildRunContext, discardOpportunity } from '../services/opportunities.service.js';

export const readWorkflows = asyncHandler((_req, res) => {
  const items = listWorkflows();
  ok(res, items, { total: items.length });
});

export const readStageCatalog = asyncHandler((_req, res) => {
  const stages = getStageCatalog();
  ok(res, stages, { total: stages.length });
});

/** Las ejecuciones se declaran antes que `/:id` para que "runs" no se lea como un ID. */
export const readRuns = asyncHandler((req, res) => {
  const { page, pageSize, offset } = parsePagination(req.query);
  const runs = listRuns({
    workflowId: req.query.workflowId,
    status: parseEnum(req.query.status, WORKFLOW_STATUSES, 'status'),
  });
  const items = runs.slice(offset, offset + pageSize).map(serializeRun);
  paginated(res, items, { page, pageSize, total: runs.length });
});

export const readRun = asyncHandler((req, res) => {
  ok(res, serializeRun(getRun(req.params.runId)));
});

export const startRun = asyncHandler((req, res) => {
  const workflow = getWorkflowOrThrow(req.params.id);

  // Una ejecucion puede nacer de una oportunidad aprobada; entonces sus etapas
  // producen artefactos de esa oportunidad en lugar del caso de demostracion.
  const opportunityId =
    req.body?.opportunityId === undefined
      ? null
      : requireString(req.body.opportunityId, 'opportunityId', { maxLength: 40 });

  const context = opportunityId ? buildRunContext(opportunityId) : null;
  const run = createRun(workflow, { context });

  accepted(res, serializeRun(run), {
    note: context
      ? `Ejecucion ligada a la oportunidad ${context.opportunityId}: cada etapa produce sus artefactos.`
      : 'La simulacion avanza en segundo plano; consulta el estado con GET /api/v1/workflows/runs/:runId.',
  });
});

export const pauseRunById = asyncHandler((req, res) => {
  ok(res, serializeRun(pauseRun(req.params.runId)));
});

export const resumeRunById = asyncHandler((req, res) => {
  ok(res, serializeRun(resumeRun(req.params.runId)));
});

export const resetRunById = asyncHandler((req, res) => {
  ok(res, serializeRun(resetRun(req.params.runId)));
});

/**
 * Aprueba la puerta de decision abierta: el flujo continua.
 */
export const approveRunById = asyncHandler((req, res) => {
  ok(res, serializeRun(approveRun(req.params.runId)));
});

/**
 * Rechaza la puerta abierta: el ciclo se detiene.
 *
 * Si la ejecucion nacia de una oportunidad, ademas se descarta con tu motivo. Es el
 * cierre del bucle: decidir que no, en el flujo, deja la oportunidad fuera de la cola
 * con la razon escrita, en lugar de dejarla ahi para que alguien la reintente.
 */
export const rejectRunById = asyncHandler((req, res) => {
  const reason =
    req.body?.reason === undefined
      ? undefined
      : requireString(req.body.reason, 'reason', { maxLength: 240, minLength: 3 });

  const run = rejectRun(req.params.runId, { reason });
  const opportunityId = run.context?.opportunityId ?? null;

  if (opportunityId) {
    discardOpportunity(opportunityId, {
      reason: reason ?? `Detenida en la puerta de "${run.rejection?.stageName ?? 'decision'}" del flujo.`,
      by: 'puerta del flujo',
    });
  }

  ok(res, {
    ...serializeRun(run),
    discardedOpportunityId: opportunityId,
  });
});

export const readWorkflow = asyncHandler((req, res) => {
  ok(res, getWorkflow(req.params.id));
});
