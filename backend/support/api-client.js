/**
 * Arranque del servidor de pruebas.
 *
 * No importa la aplicacion: la importa quien lo llama, DESPUES de haber fijado las
 * variables de entorno. Asi cada fichero de prueba puede decidir su configuracion (por
 * ejemplo, con o sin puertas de decision) sin que `config.js` las lea antes de tiempo.
 */

/** Levanta una app de Express ya construida en un puerto libre. */
export const startServerWith = async (app) => {
  const server = app.listen(0);

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  return {
    port,
    baseUrl,
    /** GET con parseo de JSON y acceso al estado HTTP. */
    async get(path) {
      const response = await fetch(`${baseUrl}${path}`);
      return { status: response.status, body: await response.json() };
    },
    /** POST sin cuerpo o con cuerpo JSON. */
    async post(path, payload) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    },
    /** Cierra el servidor y cancela los temporizadores de simulacion. */
    async close() {
      const { clearAllRuns } = await import('../src/services/workflow-simulator.js');
      const { clearAllTimers } = await import('../src/services/timers.js');
      clearAllRuns();
      clearAllTimers();
      await new Promise((resolve) => server.close(resolve));
    },
  };
};

/** Espera activa hasta que `predicate` devuelva algo cierto o se agote el tiempo. */
export const waitFor = async (predicate, { timeoutMs = 8000, intervalMs = 80, message } = {}) => {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await predicate();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    message ?? `Se agoto el tiempo de espera (${timeoutMs} ms). Ultimo valor: ${JSON.stringify(last)}`,
  );
};

/** Variables comunes a todos los arranques de prueba. */
export const applyBaseEnv = ({ gates = 'off', stepMs = '320', taskMs = '220' } = {}) => {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0';
  process.env.SIMULATION_STEP_MS = stepMs;
  process.env.SIMULATION_TASK_MS = taskMs;
  process.env.SIMULATION_TICK_MS = '60';
  process.env.SIMULATION_FAILURE_RATE = '0';
  process.env.SIMULATION_GATES = gates;
};
