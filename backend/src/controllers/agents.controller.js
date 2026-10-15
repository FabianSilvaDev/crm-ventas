/** Agentes: listado, detalle, ejecucion de tareas simuladas y estado de las tareas. */
import { AGENT_STATUSES } from '../mocks/index.js';
import {
  agentStatusSummary,
  getAgent,
  getAgentTask,
  listAgentTasks,
  listAgents,
  runAgentTask,
  serializeTask,
} from '../services/agents.service.js';
import { accepted, asyncHandler, ok, paginated } from '../utils/http.js';
import { matchesSearch, parseEnum, parsePagination, parseIntParam, requireString } from '../utils/validate.js';

const SORT_OPTIONS = ['name', 'level', 'status', 'tasks'];

export const readAgents = asyncHandler((req, res) => {
  const { page, pageSize, offset } = parsePagination(req.query);
  const items = listAgents({
    departmentId: req.query.departmentId,
    status: parseEnum(req.query.status, AGENT_STATUSES, 'status'),
    search: req.query.search,
    sort: parseEnum(req.query.sort, SORT_OPTIONS, 'sort', 'name'),
  });

  paginated(res, items.slice(offset, offset + pageSize), {
    page,
    pageSize,
    total: items.length,
    extra: { filters: { statuses: AGENT_STATUSES, sorts: SORT_OPTIONS } },
  });
});

export const readAgentSummary = asyncHandler((_req, res) => {
  ok(res, { summary: agentStatusSummary(), statuses: AGENT_STATUSES });
});

/** Las tareas se declaran antes que `/:id` para que "tasks" no se lea como un ID. */
export const readAgentTasks = asyncHandler((req, res) => {
  const { page, pageSize, offset } = parsePagination(req.query);
  const items = listAgentTasks({
    agentId: req.query.agentId,
    status: parseEnum(req.query.status, ['running', 'completed', 'error'], 'status'),
  });

  paginated(res, items.slice(offset, offset + pageSize), { page, pageSize, total: items.length });
});

export const readAgentTask = asyncHandler((req, res) => {
  ok(res, getAgentTask(req.params.taskId));
});

export const readAgent = asyncHandler((req, res) => {
  ok(res, getAgent(req.params.id));
});

export const runAgent = asyncHandler((req, res) => {
  const body = req.body ?? {};
  const title = body.title === undefined ? undefined : requireString(body.title, 'title', { maxLength: 180 });
  const stageKey = body.stageKey === undefined ? null : requireString(body.stageKey, 'stageKey', { maxLength: 60 });

  const task = runAgentTask(req.params.id, {
    title,
    stageKey,
    forceFailure: body.forceFailure === true,
  });

  accepted(res, serializeTask(task), { note: 'La tarea se ejecuta en segundo plano; consulta su estado por polling.' });
});

/** Sugerencias de busqueda usadas por el buscador del header. */
export const searchAgents = asyncHandler((req, res) => {
  const search = requireString(req.query.q, 'q', { maxLength: 60 });
  const limit = parseIntParam(req.query.limit, 'limit', { min: 1, max: 20, fallback: 5 });
  const items = listAgents({}).filter((agent) => matchesSearch(agent, search, ['name', 'role', 'specialty']));
  ok(res, items.slice(0, limit), { total: items.length, query: search });
});
