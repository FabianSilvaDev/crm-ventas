/**
 * Servicio de flujos: catalogo de etapas, definicion de flujos y estado de las
 * ejecuciones en memoria.
 */
import { notFound } from '../errors.js';
import { STAGE_BLUEPRINTS, stagesOf, workflowById, workflows } from '../mocks/index.js';
import { store } from '../store.js';
import { agentRef, agentRefs, departmentRef } from './enrich.js';

/** Expande una etapa del catalogo con sus agentes y su departamento resueltos. */
export const serializeStage = (blueprint) => ({
  key: blueprint.key,
  order: blueprint.order,
  name: blueprint.name,
  summary: blueprint.summary,
  description: blueprint.description,
  deliverables: blueprint.deliverables,
  inputs: blueprint.inputs,
  dependsOn: blueprint.dependsOn,
  estimatedMinutes: blueprint.estimatedMinutes,
  department: departmentRef(blueprint.departmentId),
  agents: agentRefs(blueprint.agentIds),
  agentIds: blueprint.agentIds,
  /** Puerta de decision de la etapa (o `null`): la vista marca donde habra que decidir. */
  gate: blueprint.gate ?? null,
  expectedOutcome: blueprint.outcome,
});

const activeRunsOf = (workflowId) =>
  [...store.runs.values()].filter(
    (run) => run.workflowId === workflowId && ['running', 'paused'].includes(run.status),
  ).length;

export const serializeWorkflow = (workflow, { expandStages = true } = {}) => ({
  id: workflow.id,
  name: workflow.name,
  description: workflow.description,
  goal: workflow.goal,
  tags: workflow.tags,
  estimatedMinutes: workflow.estimatedMinutes,
  runsCompleted: workflow.runsCompleted,
  successRate: workflow.successRate,
  ownerAgent: agentRef(workflow.ownerAgentId),
  stageCount: workflow.stageKeys.length,
  stageKeys: workflow.stageKeys,
  activeRuns: activeRunsOf(workflow.id),
  stages: expandStages ? stagesOf(workflow).map(serializeStage) : undefined,
});

export const listWorkflows = () => workflows.map((workflow) => serializeWorkflow(workflow, { expandStages: false }));

export const getWorkflowOrThrow = (workflowId) => {
  const workflow = workflowById.get(workflowId);
  if (!workflow) throw notFound(`No existe el flujo "${workflowId}".`);
  return workflow;
};

export const getWorkflow = (workflowId) => serializeWorkflow(getWorkflowOrThrow(workflowId));

/** Catalogo completo de las 17 etapas, para filtros y vistas de referencia. */
export const getStageCatalog = () =>
  STAGE_BLUEPRINTS.map(serializeStage).sort((a, b) => a.order - b.order);
