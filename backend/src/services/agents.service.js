/**
 * Servicio de agentes: consulta, detalle y ejecucion de tareas simuladas.
 *
 * Una tarea de agente se resuelve en segundo plano con retrasos controlados
 * (seccion 3 del prompt) y deja rastro en la actividad y en el resultado reciente
 * del agente, de modo que la interfaz refleja un cambio real de estado.
 */
import { config } from '../config.js';
import { notFound } from '../errors.js';
import { AGENT_STATUSES, STAGE_BLUEPRINTS } from '../mocks/index.js';
import { addAgentTask, findAgent, nextTaskId, patchAgent, pushActivity, store } from '../store.js';
import { createRandom, seedFrom } from '../utils/random.js';
import { makeId, nowIso } from '../utils/time.js';
import { matchesSearch } from '../utils/validate.js';
import { departmentRef } from './enrich.js';
import { clearTimer, scheduleInterval } from './timers.js';

const { tickMs, taskMs, failureRate } = config.simulation;

/** Resultados previstos cuando la tarea no pertenece a una etapa concreta del flujo. */
const DEPARTMENT_OUTCOMES = {
  'ops-center': {
    title: 'Plan de ejecucion actualizado',
    summary: 'Reparto de tareas recalculado sin conflictos de dependencia.',
    metrics: [{ label: 'tareas repartidas', value: '34' }],
  },
  'research-lab': {
    title: 'Hallazgo de investigacion',
    summary: 'Nuevo hallazgo incorporado al informe de mercado del producto.',
    metrics: [{ label: 'fuentes revisadas', value: '18' }],
  },
  'marketing-studio': {
    title: 'Pieza de mensaje lista',
    summary: 'Nueva variante de mensaje lista para pruebas en campana.',
    metrics: [{ label: 'variantes', value: '4' }],
  },
  'creative-studio': {
    title: 'Creatividad entregada',
    summary: 'Nuevas variantes visuales entregadas y revisadas contra la guia de marca.',
    metrics: [{ label: 'variantes', value: '6' }],
  },
  'seo-web-lab': {
    title: 'Mejora de conversion aplicada',
    summary: 'Ajuste publicado en la landing con mejora simulada de conversion.',
    metrics: [{ label: 'mejora', value: '+11%' }],
  },
  'ad-operations': {
    title: 'Reparto de presupuesto recalculado',
    summary: 'Presupuesto redistribuido entre canales segun el rendimiento reciente.',
    metrics: [{ label: 'desvio', value: '1,8%' }],
  },
  'sales-department': {
    title: 'Lote de leads procesado',
    summary: 'Leads priorizados y secuencia de contacto actualizada.',
    metrics: [{ label: 'leads', value: '12' }],
  },
  'analytics-optimization': {
    title: 'Metrica consolidada',
    summary: 'Cuadro de mando actualizado con la ultima ventana de datos.',
    metrics: [{ label: 'conversiones', value: '146' }],
  },
};

/** Serializa un agente para la API, con su departamento y su actividad reciente. */
export const serializeAgent = (agent) => ({
  id: agent.id,
  name: agent.name,
  role: agent.role,
  specialty: agent.specialty,
  avatar: agent.avatar,
  level: agent.level,
  capabilities: agent.capabilities,
  bio: agent.bio,
  department: departmentRef(agent.departmentId),
  status: agent.status,
  stats: agent.stats,
  currentTask: agent.currentTask ?? null,
  progress: agent.currentTask?.progress ?? 0,
  lastActivityAt: agent.lastActivityAt,
  recentResult: agent.recentResult ?? null,
  openTasks: store.agentTasks.filter((task) => task.agentId === agent.id && task.status === 'running').length,
});

export const listAgents = ({ departmentId, status, search, sort = 'name' } = {}) => {
  let items = store.agents.filter((agent) =>
    (departmentId ? agent.departmentId === departmentId : true) &&
    (status ? agent.status === status : true) &&
    matchesSearch(agent, search, ['name', 'role', 'specialty', 'bio']),
  );

  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name, 'es'),
    level: (a, b) => b.level - a.level || a.name.localeCompare(b.name, 'es'),
    status: (a, b) => a.status.localeCompare(b.status, 'es') || a.name.localeCompare(b.name, 'es'),
    tasks: (a, b) => b.stats.tasksCompleted - a.stats.tasksCompleted,
  };

  items = [...items].sort(sorters[sort] ?? sorters.name);
  return items.map(serializeAgent);
};

export const getAgentOrThrow = (agentId) => {
  const agent = findAgent(agentId);
  if (!agent) throw notFound(`No existe el agente "${agentId}".`);
  return agent;
};

export const getAgent = (agentId) => serializeAgent(getAgentOrThrow(agentId));

/** Resumen por estado, usado por el header y el dashboard. */
export const agentStatusSummary = () => {
  const byStatus = Object.fromEntries(AGENT_STATUSES.map((status) => [status, 0]));
  for (const agent of store.agents) byStatus[agent.status] = (byStatus[agent.status] ?? 0) + 1;
  return {
    total: store.agents.length,
    byStatus,
    active: byStatus.working + byStatus.thinking + byStatus.collaborating,
  };
};

const buildTaskResult = (agent, task) => {
  const stageBlueprint = task.stageKey ? STAGE_BLUEPRINTS.find((stage) => stage.key === task.stageKey) : null;
  if (stageBlueprint) {
    return {
      title: `${stageBlueprint.name}: resultado de tarea`,
      summary: stageBlueprint.outcome.summary,
      metrics: stageBlueprint.outcome.metrics,
      artifacts: stageBlueprint.outcome.artifacts,
    };
  }
  const outcome = DEPARTMENT_OUTCOMES[agent.departmentId] ?? {
    title: 'Tarea simulada completada',
    summary: 'El agente ha completado la tarea con un resultado de demostracion.',
    metrics: [{ label: 'duracion', value: '3s' }],
  };
  // La semilla hace que repetir la misma tarea devuelva cifras coherentes.
  const random = createRandom(seedFrom(`${agent.id}:${task.title}`));
  return {
    ...outcome,
    metrics: outcome.metrics.map((metric) => ({
      label: metric.label,
      value: `${random.int(60, 140)}%`,
    })),
    artifacts: [],
  };
};

const finishTask = (task, agent) => {
  task.finishedAt = nowIso();
  task.durationMs = Date.now() - new Date(task.startedAt).getTime();
  clearTimer(task.timer);
  task.timer = null;

  if (task.willFail) {
    task.status = 'error';
    task.error = 'El agente simulado no ha podido completar la tarea: dependencia externa no disponible.';
    patchAgent(agent.id, { status: 'error', currentTask: { ...task, error: task.error } });
    pushActivity({
      type: 'task_failed',
      severity: 'error',
      actorAgentId: agent.id,
      departmentId: agent.departmentId,
      message: `${agent.name} ha fallado la tarea "${task.title}".`,
      refs: [{ type: 'agent', id: agent.id, label: agent.name }],
    });
    return;
  }

  const result = buildTaskResult(agent, task);
  task.status = 'completed';
  task.progress = 1;
  task.result = { ...result, completedAt: task.finishedAt, durationMs: task.durationMs };

  patchAgent(agent.id, {
    status: 'completed',
    currentTask: null,
    lastActivityAt: task.finishedAt,
    recentResult: {
      id: makeId('res', store.agentTasks.length + 1),
      title: result.title,
      summary: result.summary,
      at: task.finishedAt,
      metric: result.metrics?.[0] ?? null,
    },
    stats: {
      ...agent.stats,
      tasksCompleted: agent.stats.tasksCompleted + 1,
    },
  });

  pushActivity({
    type: 'task_completed',
    severity: 'success',
    actorAgentId: agent.id,
    departmentId: agent.departmentId,
    message: `${agent.name} ha completado "${task.title}": ${result.summary}`,
    refs: [{ type: 'agent', id: agent.id, label: agent.name }],
  });
};

/**
 * Lanza una tarea simulada sobre un agente.
 * Devuelve de inmediato la tarea en estado `running`; el progreso se consulta por
 * polling con `GET /api/v1/agents/tasks/:taskId`.
 */
export const runAgentTask = (agentId, { title, stageKey = null, forceFailure } = {}) => {
  const agent = getAgentOrThrow(agentId);
  const taskTitle = title?.trim() || `${agent.specialty}: tarea simulada`;

  const willFail =
    forceFailure === true
      ? true
      : failureRate > 0
        ? createRandom(seedFrom(`${agentId}:${taskTitle}:${store.agentTasks.length}`)).next() < failureRate * 2
        : false;

  const task = {
    id: nextTaskId(),
    agentId,
    agentName: agent.name,
    department: departmentRef(agent.departmentId),
    title: taskTitle,
    stageKey,
    status: 'running',
    progress: 0,
    willFail,
    startedAt: nowIso(),
    finishedAt: null,
    durationMs: 0,
    etaMs: taskMs,
    result: null,
    error: null,
    timer: null,
  };

  patchAgent(agentId, {
    status: 'working',
    currentTask: {
      id: task.id,
      title: task.title,
      stageKey,
      progress: 0,
      etaMinutes: Math.max(1, Math.round(taskMs / 60000)),
      collaborators: [],
    },
  });

  pushActivity({
    type: 'task_started',
    severity: 'info',
    actorAgentId: agentId,
    departmentId: agent.departmentId,
    message: `${agent.name} empieza la tarea "${task.title}".`,
    refs: [{ type: 'agent', id: agentId, label: agent.name }],
  });

  addAgentTask(task);

  task.timer = scheduleInterval(() => {
    if (task.status !== 'running') return;
    task.progress = Math.min(1, Number((task.progress + tickMs / taskMs).toFixed(4)));
    const current = findAgent(agentId);
    if (current?.currentTask?.id === task.id) {
      patchAgent(agentId, { currentTask: { ...current.currentTask, progress: task.progress } });
    }
    if (task.progress >= 1) finishTask(task, agent);
  }, tickMs);

  return task;
};

export const serializeTask = (task) => ({
  id: task.id,
  agentId: task.agentId,
  agentName: task.agentName,
  department: task.department,
  title: task.title,
  stageKey: task.stageKey,
  status: task.status,
  progress: task.progress,
  startedAt: task.startedAt,
  finishedAt: task.finishedAt,
  durationMs: task.durationMs,
  etaMs: task.etaMs,
  result: task.result,
  error: task.error,
});

export const listAgentTasks = ({ agentId, status } = {}) =>
  store.agentTasks
    .filter((task) => (agentId ? task.agentId === agentId : true))
    .filter((task) => (status ? task.status === status : true))
    .map(serializeTask);

export const getAgentTask = (taskId) => {
  const task = store.agentTasks.find((item) => item.id === taskId);
  if (!task) throw notFound(`No existe la tarea "${taskId}".`);
  return serializeTask(task);
};
