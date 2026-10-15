/**
 * Servicio de configuracion: workspace, perfil, parametros de simulacion,
 * integraciones (todas simuladas o deshabilitadas) y banderas de funcionalidad.
 */
import { settings } from '../mocks/index.js';
import { config } from '../config.js';
import { store } from '../store.js';

export const getSettings = () => ({
  ...settings,
  runtime: {
    nodeEnv: config.nodeEnv,
    apiPrefix: config.apiPrefix,
    version: config.version,
    corsOrigins: config.corsOrigins,
    uptimeSeconds: Math.round(process.uptime()),
    activeRuns: [...store.runs.values()].filter((run) => ['running', 'paused'].includes(run.status)).length,
    activeTimers: store.agentTasks.filter((task) => task.status === 'running').length,
    inMemoryRuns: store.runs.size,
    inMemoryTasks: store.agentTasks.length,
  },
});
