/**
 * Simulador de flujos (seccion 12 del prompt).
 *
 * Al iniciar un flujo se crea una ejecucion, se devuelve su ID de inmediato y el
 * avance se gestiona en segundo plano con un unico temporizador por ejecucion.
 * El estado vive en memoria (`store.runs`) y se consulta por polling.
 *
 * Reglas de la simulacion:
 *  - Las etapas se ejecutan en orden de `order`; `dependsOn` se conserva para la vista.
 *  - Cada etapa avanza su progreso en ticks; al llegar a 1 se completa o falla.
 *  - Solo pueden fallar las etapas de `FAILURE_PRONE_STAGES`, con probabilidad
 *    `SIMULATION_FAILURE_RATE` y de forma reproducible por ejecucion.
 *  - Pausar detiene el temporizador; reanudar lo recrea; reiniciar deja la ejecucion
 *    en su estado inicial; reanudar tras un fallo reintenta la etapa fallida.
 */
import { config } from '../config.js';
import {
  FAILURE_PRONE_STAGES,
  STAGE_FAILURE_REASONS,
  stagesOf,
} from '../mocks/index.js';
import { patchAgent, pushActivity, pushNotification, store } from '../store.js';
import { conflict, notFound } from '../errors.js';
import { createRandom, seedFrom } from '../utils/random.js';
import { makeId, nowIso, shortId } from '../utils/time.js';
import { agentRefs, departmentRef } from './enrich.js';
import { conductResearch } from './research.service.js';
import { resolveOutcome } from './stage-outcomes.js';
import { clearTimer, scheduleInterval } from './timers.js';

const { tickMs, stepMs, failureRate, maxRuns, maxEventsPerRun } = config.simulation;

let resultCounter = 0;

/** Cuenta las ejecuciones creadas por flujo: da reproducibilidad sin repetir siempre el mismo fallo. */
const runOrdinalByWorkflow = new Map();

const logEvent = (run, type, message, stageKey = null) => {
  run.events.unshift({ id: makeId('rev', (run.eventCounter += 1)), at: nowIso(), type, message, stageKey });
  if (run.events.length > maxEventsPerRun) run.events.length = maxEventsPerRun;
};

const nowMs = () => Date.now();

/** Progreso global: etapas completadas + fraccion de la etapa en curso. */
const computeSummary = (run) => {
  const total = run.stages.length;
  const completed = run.stages.filter((stage) => stage.status === 'completed').length;
  const failed = run.stages.filter((stage) => stage.status === 'failed').length;
  const running = run.stages.filter((stage) => stage.status === 'running').length;
  const pending = run.stages.filter((stage) => stage.status === 'pending').length;
  const runningProgress = run.stages
    .filter((stage) => stage.status === 'running')
    .reduce((total2, stage) => total2 + stage.progress, 0);
  const elapsedMs = run.startedAtMs ? (run.finishedAtMs ?? nowMs()) - run.startedAtMs : 0;

  return {
    totalStages: total,
    completed,
    failed,
    running,
    pending,
    /** Etapas detenidas esperando una decision del operador. */
    blocked: run.stages.filter((stage) => stage.status === 'blocked').length,
    skipped: run.stages.filter((stage) => stage.status === 'skipped').length,
    progress: total === 0 ? 0 : Number(((completed + runningProgress) / total).toFixed(4)),
    elapsedMs: Math.max(0, elapsedMs),
    estimatedRemainingMs: Math.max(0, (pending + running) * stepMs),
  };
};

/**
 * Serializa la etapa sin sus campos internos de simulacion.
 *
 * Los agentes se resuelven AQUI, en cada serializacion, y no se guardan en la
 * ejecucion: si se guardaran quedarian congelados con el estado que tenian al crear
 * la ejecucion y la vista de flujo mostraria agentes "trabajando" en etapas ya
 * terminadas.
 */
const serializeStage = (stage) => ({
  key: stage.key,
  order: stage.order,
  name: stage.name,
  summary: stage.summary,
  description: stage.description,
  deliverables: stage.deliverables,
  inputs: stage.inputs,
  dependsOn: stage.dependsOn,
  estimatedMinutes: stage.estimatedMinutes,
  department: stage.department,
  agents: agentRefs(stage.agentIds),
  agentIds: stage.agentIds,
  /** Puerta de decision de la etapa (o `null`), para poder marcarla en la vista. */
  gate: stage.gate ?? null,
  status: stage.status,
  progress: stage.progress,
  startedAt: stage.startedAt,
  finishedAt: stage.finishedAt,
  durationMs: stage.durationMs,
  result: stage.result,
  error: stage.error,
});

/** Serializa una ejecucion para la API (sin temporizadores ni marcas internas). */
export const serializeRun = (run) => ({
  runId: run.runId,
  workflowId: run.workflowId,
  workflowName: run.workflowName,
  workflowGoal: run.workflowGoal,
  ownerAgent: run.ownerAgent,
  status: run.status,
  demo: config.demo,
  /**
   * Contexto de la ejecucion cuando nace de una oportunidad aprobada. Se publica una
   * vista compacta: la ficha completa (con toda su evidencia) se consulta en
   * `/opportunities/:id`, que es donde vive.
   */
  context: run.context
    ? {
        opportunityId: run.context.opportunityId,
        keyword: run.context.keyword,
        slug: run.context.slug,
        catalogLink: run.context.catalogLink ?? null,
      }
    : null,
  createdAt: run.createdAt,
  startedAt: run.startedAt,
  finishedAt: run.finishedAt,
  stepMs: run.stepMs,
  /** Puerta de decision abierta, si el flujo esta esperando al operador. */
  gate: run.gate ?? null,
  /** Etapas cuya puerta ya se aprobo en esta ejecucion. */
  approvedGates: [...run.approvedGates],
  /** Motivo del rechazo, si el operador detuvo el ciclo en una puerta. */
  rejection: run.rejection ?? null,
  currentStageKey: run.stages[run.currentStageIndex]?.key ?? null,
  stages: run.stages.map(serializeStage),
  events: run.events,
  summary: computeSummary(run),
});

const buildStageState = (blueprint) => ({
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
  agentIds: blueprint.agentIds,
  /** Puerta de decision de la etapa, si la tiene declarada. */
  gate: blueprint.gate ?? null,
  status: 'pending',
  progress: 0,
  startedAt: null,
  finishedAt: null,
  durationMs: 0,
  result: null,
  error: null,
});

/** Marca a los agentes de la etapa como trabajando y libera a los que ya terminaron. */
const engageAgents = (stage) => {
  for (const agent of store.agents) {
    if (agent.status === 'completed') patchAgent(agent.id, { status: 'idle', currentTask: null });
  }
  for (const agentId of stage.agentIds) {
    patchAgent(agentId, {
      status: stage.agentIds.length > 1 ? 'collaborating' : 'working',
      currentTask: {
        id: `tsk-wf-${stage.key}`,
        title: `${stage.name}: ${stage.summary}`,
        stageKey: stage.key,
        progress: 0,
        etaMinutes: Math.max(1, Math.round((stage.estimatedMinutes * (1 - stage.progress)) / 6)),
        collaborators: stage.agentIds.filter((id) => id !== agentId),
      },
    });
  }
};

const completeAgents = (stage) => {
  for (const agentId of stage.agentIds) {
    const agent = store.agents.find((item) => item.id === agentId);
    patchAgent(agentId, {
      status: 'completed',
      currentTask: null,
      lastActivityAt: nowIso(),
      recentResult: {
        id: makeId('res', (resultCounter += 1)),
        title: `${stage.name} completada`,
        summary: stage.result?.summary ?? stage.summary,
        at: nowIso(),
        metric: stage.result?.metrics?.[0] ?? null,
      },
      stats: {
        ...(agent?.stats ?? {}),
        tasksCompleted: (agent?.stats?.tasksCompleted ?? 0) + 1,
      },
    });
  }
};

const failAgents = (stage) => {
  for (const agentId of stage.agentIds) {
    const agent = store.agents.find((item) => item.id === agentId);
    patchAgent(agentId, {
      status: 'error',
      currentTask: agent?.currentTask
        ? { ...agent.currentTask, progress: stage.progress, error: stage.error }
        : null,
      lastActivityAt: nowIso(),
    });
  }
};

/** Decide si la etapa falla. La semilla hace que una misma ejecucion sea reproducible. */
const shouldFail = (run, stage) => {
  if (failureRate <= 0 || !FAILURE_PRONE_STAGES.has(stage.key)) return false;
  const random = createRandom(seedFrom(`${run.workflowId}:${stage.key}:${run.ordinal}`));
  return random.next() < failureRate;
};

/** Decide si la etapa debe detenerse en una puerta antes de ejecutarse. */
const shouldOpenGate = (run, stage) => {
  if (!config.simulation.gates) return false;
  if (!stage.gate) return false;
  return !run.approvedGates.includes(stage.key);
};

/**
 * Abre una puerta de decision: el flujo se detiene y espera al operador.
 * El temporizador se cancela, igual que en una pausa: una ejecucion esperando una
 * decision no debe seguir consumiendo ciclos.
 */
const openGate = (run, stage) => {
  run.status = 'awaiting_approval';
  run.updatedAt = nowIso();
  run.gate = {
    stageKey: stage.key,
    stageName: stage.name,
    kind: stage.gate.kind,
    question: stage.gate.question,
    detail: stage.gate.detail,
    approveLabel: stage.gate.approveLabel,
    rejectLabel: stage.gate.rejectLabel,
    openedAt: nowIso(),
    /** Lo que la etapa produciria, para que la decision no sea a ciegas. */
    preview: stage.result ?? null,
  };
  stage.status = 'blocked';

  clearTimer(run.timer);
  run.timer = null;

  logEvent(run, 'gate_opened', `El flujo se detiene en "${stage.name}" esperando tu decision.`, stage.key);
  pushActivity({
    type: 'gate_opened',
    severity: 'warning',
    actorAgentId: stage.agentIds[0] ?? null,
    departmentId: stage.department?.id ?? null,
    message: `Puerta de decision abierta en "${stage.name}": ${stage.gate.question}`,
    refs: [{ type: 'workflow', id: run.workflowId, label: run.workflowName }],
  });
  pushNotification({
    title: `Decision pendiente: ${stage.name}`,
    message: stage.gate.question,
    level: 'warning',
    link: `/workflows?run=${run.runId}`,
    linkLabel: 'Decidir ahora',
  });
};

const startStage = (run) => {
  const stage = run.stages[run.currentStageIndex];
  if (!stage) return;

  // Antes de ejecutar: ¿toca pedir permiso?
  if (shouldOpenGate(run, stage)) {
    openGate(run, stage);
    return;
  }

  stage.status = 'running';
  stage.startedAt = nowIso();
  stage.startedAtMs = nowMs();
  stage.willFail = shouldFail(run, stage);

  // La etapa de investigacion consulta las fuentes DE VERDAD mientras la simulacion
  // avanza. Si la consulta termina antes que la etapa, el resultado usa sus datos; si no,
  // la etapa se completa con lo que ya sabiamos y el informe queda registrado igualmente.
  if (stage.key === 'research' && run.context) {
    run.researchResult = null;
    run.researchError = null;
    conductResearch({
      opportunityId: run.context.opportunityId,
      keyword: run.context.keyword,
      mode: run.context.opportunity?.latest?.sourceMode ?? 'auto',
      geo: run.context.opportunity?.latest?.geo ?? config.trends.geo,
      timeframe: run.context.opportunity?.latest?.timeframe ?? config.trends.timeframe,
    })
      .then((report) => {
        run.researchResult = report;
      })
      .catch((error) => {
        run.researchError = error.message;
      });
  }

  logEvent(run, 'stage_started', `Etapa "${stage.name}" en curso (${stage.agentIds.length} agente/s).`, stage.key);
  pushActivity({
    type: 'workflow_stage',
    severity: 'info',
    actorAgentId: stage.agentIds[0] ?? null,
    departmentId: stage.department?.id ?? null,
    message: `Etapa "${stage.name}" iniciada en el flujo ${run.workflowName}.`,
    refs: [{ type: 'workflow', id: run.workflowId, label: run.workflowName }],
  });
  engageAgents(stage);
};

const finishStage = (run) => {
  const stage = run.stages[run.currentStageIndex];

  if (stage.willFail) {
    stage.status = 'failed';
    stage.finishedAt = nowIso();
    stage.durationMs = nowMs() - (stage.startedAtMs ?? nowMs());
    stage.error = STAGE_FAILURE_REASONS[stage.key] ?? 'Fallo simulado controlado en la etapa.';
    run.status = 'failed';
    run.finishedAt = run.updatedAt = nowIso();
    run.finishedAtMs = nowMs();
    failAgents(stage);
    clearTimer(run.timer);
    run.timer = null;

    logEvent(run, 'stage_failed', `Etapa "${stage.name}" fallida: ${stage.error}`, stage.key);
    pushActivity({
      type: 'task_failed',
      severity: 'error',
      actorAgentId: stage.agentIds[0] ?? null,
      departmentId: stage.department?.id ?? null,
      message: `Fallo controlado en "${stage.name}": ${stage.error}`,
      refs: [{ type: 'workflow', id: run.workflowId, label: run.workflowName }],
    });
    pushNotification({
      title: `Fallo en la etapa ${stage.name}`,
      message: stage.error,
      level: 'error',
      link: '/workflows',
      linkLabel: 'Ver flujo',
    });
    return;
  }

  stage.status = 'completed';
  stage.progress = 1;
  stage.finishedAt = nowIso();
  stage.durationMs = nowMs() - (stage.startedAtMs ?? nowMs());

  // El resultado se resuelve AQUI, no se copia de la plantilla: con una oportunidad en
  // el contexto, sus cifras y sus artefactos son los de esa oportunidad. Y si la etapa de
  // investigacion ha consultado las fuentes, su informe real viaja en el contexto.
  const outcome = resolveOutcome(
    stage.key,
    run.context ? { ...run.context, research: run.researchResult, researchError: run.researchError } : null,
  );

  stage.result = {
    summary: outcome.summary,
    metrics: outcome.metrics,
    artifacts: outcome.artifacts,
    completedAt: stage.finishedAt,
    durationMs: stage.durationMs,
  };
  completeAgents(stage);

  logEvent(run, 'stage_completed', `Etapa "${stage.name}" completada.`, stage.key);
  pushActivity({
    type: 'workflow_stage',
    severity: 'success',
    actorAgentId: stage.agentIds[0] ?? null,
    departmentId: stage.department?.id ?? null,
    message: `Etapa "${stage.name}" completada: ${stage.result.summary}`,
    refs: (stage.result.artifacts ?? []).slice(0, 2),
  });

  run.currentStageIndex += 1;

  if (run.currentStageIndex >= run.stages.length) {
    run.status = 'completed';
    run.finishedAt = run.updatedAt = nowIso();
    run.finishedAtMs = nowMs();
    clearTimer(run.timer);
    run.timer = null;
    for (const agent of store.agents) {
      if (agent.status === 'completed') patchAgent(agent.id, { status: 'idle', currentTask: null });
    }
    logEvent(run, 'run_completed', 'Flujo completado: todas las etapas han terminado.');
    pushActivity({
      type: 'workflow_completed',
      severity: 'success',
      actorAgentId: run.ownerAgent?.id ?? null,
      message: `Flujo "${run.workflowName}" completado con ${run.stages.length} etapas.`,
      refs: [{ type: 'workflow', id: run.workflowId, label: run.workflowName }],
    });
    pushNotification({
      title: 'Flujo completado',
      message: `"${run.workflowName}" ha terminado sus ${run.stages.length} etapas.`,
      level: 'success',
      link: '/workflows',
      linkLabel: 'Ver resultados',
    });
  }
};

const tick = (run) => {
  if (run.status !== 'running') return;
  run.updatedAt = nowIso();
  const stage = run.stages[run.currentStageIndex];

  if (!stage) return;
  if (stage.status === 'pending') {
    startStage(run);
    return;
  }
  if (stage.status !== 'running') return;

  stage.progress = Math.min(1, Number((stage.progress + tickMs / run.stepMs).toFixed(4)));
  for (const agentId of stage.agentIds) {
    const agent = store.agents.find((item) => item.id === agentId);
    if (agent?.currentTask) {
      patchAgent(agentId, {
        currentTask: { ...agent.currentTask, progress: stage.progress },
      });
    }
  }
  if (stage.progress >= 1) finishStage(run);
};

const startTimer = (run) => {
  clearTimer(run.timer);
  run.timer = scheduleInterval(() => tick(run), tickMs);
};

/** Crea y arranca una ejecucion para un flujo del catalogo. */
export const createRun = (workflow, { stepMsOverride, context = null } = {}) => {
  if (store.runs.size >= maxRuns) {
    throw conflict(
      `Se alcanzo el limite de ${maxRuns} ejecuciones en memoria. Reinicia o elimina alguna antes de crear otra.`,
      { maxRuns },
    );
  }

  const ordinal = (runOrdinalByWorkflow.get(workflow.id) ?? 0) + 1;
  runOrdinalByWorkflow.set(workflow.id, ordinal);

  const run = {
    runId: shortId('run'),
    workflowId: workflow.id,
    workflowName: workflow.name,
    workflowGoal: workflow.goal,
    ownerAgent: null,
    /** Oportunidad que origina la ejecucion (o `null` si es la demo pura). */
    context,
    /** Puerta abierta esperando decision, si la hay. */
    gate: null,
    /** Etapas cuya puerta ha aprobado ya el operador. */
    approvedGates: [],
    /** Informe real de la etapa de investigacion, cuando la consulta ha terminado. */
    researchResult: null,
    researchError: null,
    status: 'running',
    ordinal,
    eventCounter: 0,
    createdAt: nowIso(),
    startedAt: nowIso(),
    startedAtMs: nowMs(),
    updatedAt: nowIso(),
    finishedAt: null,
    finishedAtMs: null,
    stepMs: stepMsOverride ?? stepMs,
    currentStageIndex: 0,
    stages: stagesOf(workflow).map((blueprint) => {
      const stage = buildStageState(blueprint);
      stage.willFail = false;
      return stage;
    }),
    events: [],
    timer: null,
  };

  run.ownerAgent = agentRefs([workflow.ownerAgentId])[0] ?? null;

  store.runs.set(run.runId, run);
  logEvent(run, 'run_created', `Ejecucion creada para "${workflow.name}" con ${run.stages.length} etapas.`);
  startTimer(run);

  return run;
};

const requireRun = (runId) => {
  const run = store.runs.get(runId);
  if (!run) throw notFound(`No existe la ejecucion "${runId}".`);
  return run;
};

export const getRun = (runId) => requireRun(runId);

export const listRuns = ({ workflowId, status } = {}) =>
  [...store.runs.values()]
    .filter((run) => (workflowId ? run.workflowId === workflowId : true))
    .filter((run) => (status ? run.status === status : true))
    .sort((a, b) => b.startedAtMs - a.startedAtMs);

export const pauseRun = (runId) => {
  const run = requireRun(runId);
  if (run.status !== 'running') {
    throw conflict(`Solo se puede pausar una ejecucion en curso (estado actual: ${run.status}).`);
  }
  run.status = 'paused';
  run.updatedAt = nowIso();
  clearTimer(run.timer);
  run.timer = null;
  for (const stage of run.stages) {
    for (const agentId of stage.agentIds) {
      if (stage.status === 'running') patchAgent(agentId, { status: 'idle' });
    }
  }
  logEvent(run, 'run_paused', 'Ejecucion pausada por el usuario.');
  pushActivity({
    type: 'workflow_paused',
    severity: 'warning',
    message: `Flujo "${run.workflowName}" pausado.`,
    refs: [{ type: 'workflow', id: run.workflowId, label: run.workflowName }],
  });
  return run;
};

export const resumeRun = (runId) => {
  const run = requireRun(runId);
  if (run.status === 'completed') {
    throw conflict('La ejecucion ya ha terminado; reiniciala para volver a ejecutarla.');
  }
  if (run.status === 'running') {
    throw conflict('La ejecucion ya esta en curso.');
  }
  if (run.status === 'awaiting_approval') {
    throw conflict(
      'La ejecucion esta esperando una decision: aprueba o rechaza la puerta abierta en lugar de reanudarla.',
      { gate: run.gate?.stageKey ?? null },
    );
  }
  if (run.status === 'rejected') {
    throw conflict('La ejecucion se detuvo porque el operador rechazo la puerta; reiniciala para repetirla.');
  }

  // Tras un fallo, reanudar reintenta la etapa fallida desde cero.
  const failedStage = run.stages.find((stage) => stage.status === 'failed');
  if (failedStage) {
    failedStage.status = 'pending';
    failedStage.progress = 0;
    failedStage.error = null;
    failedStage.startedAt = null;
    failedStage.finishedAt = null;
    failedStage.durationMs = 0;
    run.currentStageIndex = run.stages.indexOf(failedStage);
    // El reintento usa una semilla distinta para no fallar siempre en el mismo punto.
    run.ordinal += 1000;
  }

  run.status = 'running';
  run.finishedAt = null;
  run.finishedAtMs = null;
  if (!run.startedAtMs) run.startedAtMs = nowMs();
  run.updatedAt = nowIso();
  startTimer(run);
  logEvent(
    run,
    'run_resumed',
    failedStage ? `Reintentando la etapa "${failedStage.name}".` : 'Ejecucion reanudada.',
  );
  pushActivity({
    type: 'workflow_resumed',
    severity: 'info',
    message: `Flujo "${run.workflowName}" reanudado${failedStage ? ` desde "${failedStage.name}"` : ''}.`,
    refs: [{ type: 'workflow', id: run.workflowId, label: run.workflowName }],
  });
  return run;
};

export const resetRun = (runId) => {
  const run = requireRun(runId);
  clearTimer(run.timer);
  run.timer = null;
  run.status = 'running';
  run.startedAt = nowIso();
  run.startedAtMs = nowMs();
  run.updatedAt = nowIso();
  run.finishedAt = null;
  run.finishedAtMs = null;
  run.currentStageIndex = 0;
  run.events = [];
  run.eventCounter = 0;
  run.ordinal += 1000;
  // Reiniciar devuelve tambien las puertas a su estado inicial: hay que volver a decidir.
  run.gate = null;
  run.approvedGates = [];
  run.rejection = null;
  run.researchResult = null;
  run.researchError = null;

  for (const stage of run.stages) {
    stage.status = 'pending';
    stage.progress = 0;
    stage.startedAt = null;
    stage.finishedAt = null;
    stage.durationMs = 0;
    stage.result = null;
    stage.error = null;
    stage.willFail = false;
  }

  logEvent(run, 'run_reset', 'Ejecucion reiniciada a su estado inicial.');
  pushActivity({
    type: 'workflow_reset',
    severity: 'info',
    message: `Flujo "${run.workflowName}" reiniciado.`,
    refs: [{ type: 'workflow', id: run.workflowId, label: run.workflowName }],
  });
  startTimer(run);
  return run;
};

/** Detiene y olvida todas las ejecuciones (apagado ordenado y pruebas). */
export const clearAllRuns = () => {
  for (const run of store.runs.values()) clearTimer(run.timer);
  store.runs.clear();
  runOrdinalByWorkflow.clear();
};

/**
 * Aprueba la puerta abierta: el flujo continua por donde iba.
 * Solo tiene sentido si hay una puerta esperando; si no, es un conflicto.
 */
export const approveRun = (runId) => {
  const run = requireRun(runId);
  if (run.status !== 'awaiting_approval' || !run.gate) {
    throw conflict(`La ejecucion no esta esperando ninguna decision (estado actual: ${run.status}).`);
  }

  const stage = run.stages.find((item) => item.key === run.gate.stageKey);
  const kind = run.gate.kind;
  const name = run.gate.stageName;

  run.approvedGates.push(run.gate.stageKey);
  run.gate = null;
  if (stage) stage.status = 'pending';
  run.status = 'running';
  run.updatedAt = nowIso();

  startTimer(run);
  logEvent(run, 'gate_approved', `Puerta de "${name}" aprobada: el flujo continua.`, stage?.key ?? null);
  pushActivity({
    type: 'gate_approved',
    severity: 'success',
    actorAgentId: stage?.agentIds[0] ?? null,
    departmentId: stage?.department?.id ?? null,
    message: `Puerta "${name}" (${kind}) aprobada por el operador: el flujo continua.`,
    refs: [{ type: 'workflow', id: run.workflowId, label: run.workflowName }],
  });

  return run;
};

/**
 * Rechaza la puerta abierta: el ciclo se detiene aqui.
 *
 * Las etapas que ya estaban hechas se conservan (el trabajo no se borra), y las que
 * quedaban pasan a `skipped`: se sabe exactamente donde se paro y por que.
 *
 * El efecto sobre la oportunidad (descartarla con el motivo) lo aplica el controlador:
 * asi el simulador no depende del servicio de oportunidades.
 */
export const rejectRun = (runId, { reason } = {}) => {
  const run = requireRun(runId);
  if (run.status !== 'awaiting_approval' || !run.gate) {
    throw conflict(`La ejecucion no esta esperando ninguna decision (estado actual: ${run.status}).`);
  }

  const gate = run.gate;
  const stage = run.stages.find((item) => item.key === gate.stageKey);

  if (stage) {
    stage.status = 'skipped';
    stage.error = reason ?? 'Rechazada en la puerta de decision.';
    stage.finishedAt = nowIso();
  }
  // Las etapas posteriores no se ejecutan: el ciclo termina donde el operador dijo.
  for (const other of run.stages) {
    if (other.status === 'pending') other.status = 'skipped';
  }

  run.status = 'rejected';
  run.gate = null;
  run.rejection = { stageKey: gate.stageKey, stageName: gate.stageName, kind: gate.kind, reason: reason ?? null, at: nowIso() };
  run.finishedAt = run.updatedAt = nowIso();
  run.finishedAtMs = nowMs();

  clearTimer(run.timer);
  run.timer = null;

  for (const agent of store.agents) {
    if (['working', 'collaborating', 'thinking'].includes(agent.status)) {
      patchAgent(agent.id, { status: 'idle', currentTask: null });
    }
  }

  logEvent(run, 'gate_rejected', `Puerta de "${gate.stageName}" rechazada: el ciclo se detiene.`, gate.stageKey);
  // El motivo se cita dentro de una frase: se le quita el punto final para no encadenar dos.
  const quoted = reason ? reason.replace(/[.\s]+$/, '') : null;
  pushActivity({
    type: 'gate_rejected',
    severity: 'error',
    actorAgentId: stage?.agentIds[0] ?? null,
    departmentId: stage?.department?.id ?? null,
    message: `Puerta "${gate.stageName}" rechazada${quoted ? `: ${quoted}` : ''}. El ciclo se detiene en la etapa ${stage?.order ?? '?'}.`,
    refs: [{ type: 'workflow', id: run.workflowId, label: run.workflowName }],
  });
  pushNotification({
    title: `Ciclo detenido en ${gate.stageName}`,
    message: reason ?? 'El operador rechazo la puerta de decision.',
    level: 'error',
    link: `/workflows?run=${run.runId}`,
    linkLabel: 'Ver la ejecucion',
  });

  return run;
};
