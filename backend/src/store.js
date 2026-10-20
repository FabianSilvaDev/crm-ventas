/**
 * Estado en memoria del backend.
 *
 * Los modulos de `mocks/` describen el estado INICIAL de la demostracion. Todo lo
 * que puede cambiar mientras el servidor esta vivo (estado de los agentes, tareas,
 * ejecuciones de flujo, actividad y notificaciones) vive aqui.
 *
 * Seccion 12 del prompt: los datos y las ejecuciones se pierden al reiniciar el
 * servidor, y eso es intencionado en esta primera version.
 */
import { agents as baseAgents, activityEvents, notifications as baseNotifications } from './mocks/index.js';
import { makeId, nowIso } from './utils/time.js';

const MAX_ACTIVITY = 300;

export const store = {
  /** Copia mutable de los agentes: estado, tarea actual y estadisticas. */
  agents: structuredClone(baseAgents),
  /** Feed de actividad, siempre ordenado de mas reciente a mas antiguo. */
  activity: structuredClone(activityEvents),
  notifications: structuredClone(baseNotifications),
  /** Ejecuciones de flujo activas o terminadas, por runId. */
  runs: new Map(),
  /** Tareas sueltas ejecutadas sobre agentes, de mas reciente a mas antiguo. */
  agentTasks: [],
  /**
   * Oportunidades registradas por el intake (Yanca). Cada una guarda su ultimo
   * estudio y el historial de revisiones, para poder ver como cambio la valoracion.
   */
  opportunities: [],
  /**
   * Informes de investigacion GENERADOS por una ejecucion real (no los de la demo).
   * Se guardan aparte de los mocks para poder distinguir siempre su origen.
   */
  researchReports: [],
};

let activityCounter = store.activity.length;
let taskCounter = 1000;
let opportunityCounter = 0;
let researchCounter = 1000;

export const nextTaskId = () => makeId('tsk', (taskCounter += 1));

/** Identificador de un informe generado: `rsc-1001`. Los de la demo son rsc-000X. */
export const nextResearchId = () => makeId('rsc', (researchCounter += 1));

/** Identificador estable de oportunidad: `opp-0001`. */
export const nextOpportunityId = () => makeId('opp', (opportunityCounter += 1));

/** Anade un evento al feed de actividad y lo devuelve. */
export const pushActivity = ({ type, severity = 'info', actorAgentId = null, departmentId = null, message, refs = [] }) => {
  const entry = {
    id: makeId('evt', (activityCounter += 1)),
    at: nowIso(),
    type,
    severity,
    actorAgentId,
    departmentId,
    message,
    refs,
  };
  store.activity.unshift(entry);
  if (store.activity.length > MAX_ACTIVITY) store.activity.length = MAX_ACTIVITY;
  return entry;
};

export const pushNotification = ({ title, message, level = 'info', link = null, linkLabel = null }) => {
  const entry = {
    id: makeId('ntf', store.notifications.length + 1),
    title,
    message,
    level,
    at: nowIso(),
    read: false,
    link,
    linkLabel,
  };
  store.notifications.unshift(entry);
  if (store.notifications.length > 60) store.notifications.length = 60;
  return entry;
};

/** Busca un agente en el estado mutable. */
export const findAgent = (agentId) => store.agents.find((agent) => agent.id === agentId);

/** Aplica un parche parcial a un agente y devuelve el agente actualizado. */
export const patchAgent = (agentId, patch) => {
  const agent = findAgent(agentId);
  if (!agent) return undefined;
  Object.assign(agent, patch, { updatedAt: nowIso() });
  return agent;
};

export const addAgentTask = (task) => {
  store.agentTasks.unshift(task);
  if (store.agentTasks.length > 200) store.agentTasks.length = 200;
  return task;
};
