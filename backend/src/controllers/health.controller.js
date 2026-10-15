/** Health check: confirma que la API simulada esta viva y en que modo opera. */
import process from 'node:process';
import { config } from '../config.js';
import { store } from '../store.js';
import { asyncHandler, ok } from '../utils/http.js';
import { activeTimerCount } from '../services/timers.js';

export const getHealth = asyncHandler((_req, res) => {
  const memory = process.memoryUsage();

  ok(res, {
    status: 'ok',
    service: 'ai-operations-cms-backend',
    version: config.version,
    nodeEnv: config.nodeEnv,
    node: process.version,
    demoMode: config.demo,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    simulation: {
      stepMs: config.simulation.stepMs,
      taskMs: config.simulation.taskMs,
      failureRate: config.simulation.failureRate,
      pollIntervalMs: config.pollIntervalMs,
    },
    inMemory: {
      agents: store.agents.length,
      activityEvents: store.activity.length,
      runs: store.runs.size,
      agentTasks: store.agentTasks.length,
      timers: activeTimerCount(),
    },
    memoryUsageMb: Number((memory.rss / 1024 / 1024).toFixed(1)),
  });
});
