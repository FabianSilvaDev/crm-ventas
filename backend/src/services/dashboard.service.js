/**
 * Servicio del dashboard: vista agregada de toda la operacion.
 * Todos los indicadores salen de los mocks y del estado en memoria; ninguno se
 * inventa en el frontend (seccion 7 del prompt).
 */
import { config } from '../config.js';
import { workflows } from '../mocks/index.js';
import { store } from '../store.js';
import { agentStatusSummary } from './agents.service.js';
import {
  campaignRanking,
  campaignTotals,
  departmentWorkload,
  leadTotals,
  leadsSeries,
  landingTotals,
  productTotals,
  revenueSeries,
} from './metrics.js';

/** Salud global de la operacion: una lectura rapida de si todo va bien. */
const operationHealth = (agentSummary, leadSummary, campaignSummary) => {
  const signals = [];

  const errorAgents = agentSummary.byStatus.error ?? 0;
  const offlineAgents = agentSummary.byStatus.offline ?? 0;
  if (errorAgents > 0) {
    signals.push({
      level: 'error',
      label: `${errorAgents} agente/s en error`,
      detail: 'Hay agentes que no han podido completar su ultima tarea simulada.',
      link: '/agents',
    });
  }
  if (offlineAgents > 0) {
    signals.push({
      level: 'warning',
      label: `${offlineAgents} agente/s fuera de linea`,
      detail: 'Los agentes fuera de linea no reciben tareas nuevas.',
      link: '/agents',
    });
  }

  const failedRuns = [...store.runs.values()].filter((run) => run.status === 'failed').length;
  if (failedRuns > 0) {
    signals.push({
      level: 'error',
      label: `${failedRuns} flujo/s detenido/s por error`,
      detail: 'Se puede reanudar la ejecucion para reintentar la etapa fallida.',
      link: '/workflows',
    });
  }

  if (campaignSummary.budgetPacing > 1) {
    signals.push({
      level: 'warning',
      label: 'Gasto por encima del presupuesto planificado',
      detail: `El gasto simulado alcanza el ${Math.round(campaignSummary.budgetPacing * 100)}% del presupuesto total.`,
      link: '/campaigns',
    });
  }

  if (leadSummary.open > 0) {
    signals.push({
      level: 'info',
      label: `${leadSummary.open} oportunidades abiertas`,
      detail: `Valor simulado en pipeline: ${leadSummary.pipelineValue.toLocaleString('es-ES')} EUR.`,
      link: '/leads',
    });
  }

  // Puntuacion simple y explicable: cada senal resta, con un suelo de 0.
  const penalty = signals.reduce((total, signal) => {
    if (signal.level === 'error') return total + 18;
    if (signal.level === 'warning') return total + 8;
    return total + 2;
  }, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    score,
    label: score >= 85 ? 'Operacion estable' : score >= 65 ? 'Requiere atencion' : 'Operacion degradada',
    signals,
  };
};

/** Ultimas tareas: las ejecutadas sobre agentes y las etapas de flujo mas recientes. */
const latestTasks = () => {
  const agentTasks = store.agentTasks.slice(0, 6).map((task) => ({
    id: task.id,
    kind: 'agent-task',
    title: task.title,
    agentId: task.agentId,
    agentName: task.agentName,
    department: task.department,
    status: task.status,
    progress: task.progress,
    at: task.finishedAt ?? task.startedAt,
  }));

  const stageTasks = [...store.runs.values()]
    .flatMap((run) =>
      run.stages
        .filter((stage) => stage.status !== 'pending')
        .map((stage) => ({
          id: `${run.runId}:${stage.key}`,
          kind: 'workflow-stage',
          title: `${stage.name}`,
          agentId: stage.agentIds[0] ?? null,
          agentName: stage.agents[0]?.name ?? null,
          department: stage.department,
          status: stage.status,
          progress: stage.progress,
          at: stage.finishedAt ?? stage.startedAt,
          runId: run.runId,
          workflowName: run.workflowName,
        })),
    )
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6);

  return [...agentTasks, ...stageTasks]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);
};

export const getDashboard = () => {
  const agentSummary = agentStatusSummary();
  const leadSummary = leadTotals();
  const campaignSummary = campaignTotals();
  const productSummary = productTotals();
  const landingSummary = landingTotals();

  const runningRuns = [...store.runs.values()].filter((run) => run.status === 'running').length;
  const pausedRuns = [...store.runs.values()].filter((run) => run.status === 'paused').length;
  const completedRuns = [...store.runs.values()].filter((run) => run.status === 'completed').length;

  return {
    kpis: {
      agents: {
        total: agentSummary.total,
        active: agentSummary.active,
        byStatus: agentSummary.byStatus,
      },
      workflows: {
        templates: workflows.length,
        running: runningRuns,
        paused: pausedRuns,
        completed: completedRuns,
        failed: [...store.runs.values()].filter((run) => run.status === 'failed').length,
      },
      products: {
        total: productSummary.total,
        validated: productSummary.validated + productSummary.live,
        researching: productSummary.researching + productSummary.validating,
        catalogRevenue: productSummary.catalogRevenue,
      },
      campaigns: {
        total: campaignSummary.total,
        active: campaignSummary.active,
        spend: campaignSummary.spend,
        revenue: campaignSummary.revenue,
        roas: campaignSummary.roas,
      },
      leads: {
        total: leadSummary.total,
        open: leadSummary.open,
        won: leadSummary.won,
        conversionRate: leadSummary.conversionRate,
        pipelineValue: leadSummary.pipelineValue,
      },
      conversions: {
        total: campaignSummary.conversions,
        landingRate: landingSummary.conversionRate,
        cpa: campaignSummary.cpa,
      },
      revenue: {
        simulated: campaignSummary.revenue + productSummary.catalogRevenue,
        currency: 'EUR',
        note: 'Cifras simuladas de demostracion',
      },
    },
    operationHealth: operationHealth(agentSummary, leadSummary, campaignSummary),
    charts: {
      leadsSeries: leadsSeries(14),
      revenueSeries: revenueSeries(14),
      departmentWorkload: departmentWorkload(),
      campaignRanking: campaignRanking(5),
      leadFunnel: leadSummary.byStatus,
    },
    recentActivity: store.activity.slice(0, 10),
    latestTasks: latestTasks(),
    demo: {
      referenceDate: store.activity[0]?.at ?? null,
      simulation: {
        stepMs: config.simulation.stepMs,
        taskMs: config.simulation.taskMs,
        failureRate: config.simulation.failureRate,
        pollIntervalMs: config.pollIntervalMs,
      },
    },
  };
};
