/**
 * Pruebas de flujos: catalogo, ejecucion simulada en el servidor y control
 * (pausa, reanudacion y reinicio).
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startServer, waitFor } from '../support/api-harness.js';

let api;

before(async () => {
  api = await startServer();
});

after(async () => {
  await api.close();
});

describe('Catalogo de flujos', () => {
  it('lista los flujos disponibles', async () => {
    const { status, body } = await api.get('/workflows');

    assert.equal(status, 200);
    assert.ok(body.data.length >= 4);
    assert.ok(body.data.every((workflow) => workflow.stageCount > 0));
  });

  it('el flujo completo expone las 17 etapas en orden con sus dependencias', async () => {
    const { body } = await api.get('/workflows/wf-full-cycle');
    const stages = body.data.stages;

    assert.equal(stages.length, 17);
    assert.deepEqual(
      stages.map((stage) => stage.order),
      Array.from({ length: 17 }, (_, index) => index + 1),
    );
    assert.equal(stages[0].key, 'opportunity');
    assert.equal(stages[16].key, 'learning');
    assert.ok(stages[1].dependsOn.includes('opportunity'), 'la etapa 2 deberia depender de la 1');
    assert.ok(stages.every((stage) => stage.department?.id && stage.agents.length > 0));
  });

  it('devuelve 404 en un flujo inexistente', async () => {
    const { status } = await api.get('/workflows/wf-inventado');
    assert.equal(status, 404);
  });
});

describe('Ejecucion simulada', () => {
  it('crea la ejecucion (202), avanza etapas en el servidor y termina', async () => {
    const started = await api.post('/workflows/wf-market-research/run');
    assert.equal(started.status, 202);

    const runId = started.body.data.runId;
    assert.ok(runId);
    assert.equal(started.body.data.status, 'running');
    assert.equal(started.body.data.stages.length, 4);
    assert.ok(started.body.data.stages.every((stage) => stage.status === 'pending'));

    const advanced = await waitFor(
      async () => {
        const { body } = await api.get(`/workflows/runs/${runId}`);
        return body.data.stages[0].status === 'running' ? body.data : null;
      },
      { message: 'la primera etapa no llego a ejecutarse' },
    );
    assert.ok(advanced.stages[0].agents[0].status !== 'offline');

    const finished = await waitFor(
      async () => {
        const { body } = await api.get(`/workflows/runs/${runId}`);
        return body.data.status === 'completed' ? body.data : null;
      },
      { timeoutMs: 12000, message: 'el flujo no termino a tiempo' },
    );

    assert.equal(finished.summary.completed, 4);
    assert.equal(finished.summary.progress, 1);
    assert.ok(finished.stages.every((stage) => stage.status === 'completed'));
    assert.ok(finished.stages.every((stage) => stage.result?.summary), 'cada etapa deberia dejar un resultado');
    assert.ok(finished.events.length >= 4, 'deberia registrar eventos del flujo');
    assert.ok(finished.finishedAt);
  });

  it('mantiene el estado en el backend: la ejecucion se puede consultar de nuevo', async () => {
    const { body: runs } = await api.get('/workflows/runs');
    assert.ok(runs.data.length > 0, 'las ejecuciones deberian persistir mientras el servidor vive');

    const runId = runs.data[0].runId;
    const first = await api.get(`/workflows/runs/${runId}`);
    const second = await api.get(`/workflows/runs/${runId}`);
    assert.deepEqual(first.body.data.summary, second.body.data.summary);
  });

  it('devuelve 404 al consultar una ejecucion inexistente', async () => {
    const { status, body } = await api.get('/workflows/runs/run-inventado');

    assert.equal(status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});

describe('Pausa, reanudacion y reinicio', () => {
  it('pausa, reanuda y reinicia una ejecucion', async () => {
    const started = await api.post('/workflows/wf-sales-loop/run');
    const runId = started.body.data.runId;

    await waitFor(async () => {
      const { body } = await api.get(`/workflows/runs/${runId}`);
      return body.data.summary.progress > 0;
    }, { message: 'la ejecucion no avanzo antes de pausarla' });

    const paused = await api.post(`/workflows/runs/${runId}/pause`);
    assert.equal(paused.status, 200);
    assert.equal(paused.body.data.status, 'paused');

    // El progreso no debe avanzar mientras esta en pausa.
    const progressAtPause = paused.body.data.summary.progress;
    await new Promise((resolve) => setTimeout(resolve, 500));
    const stillPaused = await api.get(`/workflows/runs/${runId}`);
    assert.equal(stillPaused.body.data.status, 'paused');
    assert.equal(stillPaused.body.data.summary.progress, progressAtPause);

    const resumed = await api.post(`/workflows/runs/${runId}/resume`);
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.data.status, 'running');

    const afterResume = await waitFor(async () => {
      const { body } = await api.get(`/workflows/runs/${runId}`);
      return body.data.summary.progress > progressAtPause ? body.data : null;
    }, { message: 'la ejecucion no continuo tras reanudar' });
    assert.ok(afterResume.summary.progress > progressAtPause);

    const reset = await api.post(`/workflows/runs/${runId}/reset`);
    assert.equal(reset.status, 200);
    assert.equal(reset.body.data.status, 'running');
    assert.equal(reset.body.data.summary.completed, 0);
    assert.equal(reset.body.data.currentStageKey, 'lead-acquisition');

    await api.post(`/workflows/runs/${runId}/pause`);
  });

  it('rechaza pausar dos veces con 409', async () => {
    const started = await api.post('/workflows/wf-market-research/run');
    const runId = started.body.data.runId;

    await api.post(`/workflows/runs/${runId}/pause`);
    const second = await api.post(`/workflows/runs/${runId}/pause`);

    assert.equal(second.status, 409);
    assert.equal(second.body.error.code, 'CONFLICT');

    await api.post(`/workflows/runs/${runId}/resume`);
    await api.post(`/workflows/runs/${runId}/reset`);
  });
});
