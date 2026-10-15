/**
 * Arranque del backend.
 *
 * Los datos y las ejecuciones viven en memoria: al detener el proceso se pierden
 * (seccion 12 del prompt). El apagado es ordenado: se cancelan todos los
 * temporizadores de simulacion antes de cerrar el servidor.
 */
import process from 'node:process';
import { createApp } from './app.js';
import { config } from './config.js';
import { clearAllTimers } from './services/timers.js';
import { clearAllRuns } from './services/workflow-simulator.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info('server_started', {
    url: `http://localhost:${config.port}`,
    api: `http://localhost:${config.port}${config.apiPrefix}`,
    env: config.nodeEnv,
    demoMode: config.demo,
    corsOrigins: config.corsOrigins,
    simulation: config.simulation,
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error('port_in_use', {
      port: config.port,
      hint: `El puerto ${config.port} esta ocupado. Arranca con otro puerto: $env:PORT=3100; npm run dev`,
    });
    process.exit(1);
  }
  logger.error('server_error', { message: error.message });
  process.exit(1);
});

let shuttingDown = false;

const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutdown_started', { signal });

  clearAllRuns();
  clearAllTimers();

  server.close(() => {
    logger.info('shutdown_completed', {
      note: 'Las ejecuciones y los datos en memoria se han descartado.',
    });
    process.exit(0);
  });

  // Red de seguridad: si alguna conexion se queda colgada, cerramos igualmente.
  setTimeout(() => process.exit(0), 3000).unref();
};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal));
}

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
});
