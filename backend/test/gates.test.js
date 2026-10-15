/**
 * Pruebas de las puertas de decision del flujo (paso 5).
 *
 * Este fichero arranca la API CON las puertas activadas: el flujo debe detenerse en
 * validacion, presupuesto y publicacion, y continuar (o no) segun lo que decida el
 * operador.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startServer, waitFor } from '../support/gated-harness.js';

let api;

before(async () => {
  api = await startServer();
});

after(async () => {
  await api.close();
});

/** Espera a que la ejecucion se detenga en una puerta. */
const waitForGate = (runId, timeoutMs = 12000) =>
  waitFor(
    async () => {
      const { body } = await api.get(`/workflows/runs/${runId}`);
      return body.data.status === 'awaiting_approval' ? body.data : null;
    },
    { timeoutMs, message: 'el flujo no llego a detenerse en una puerta' },
  );

describe('Puertas de decision', () => {
  it('el catalogo declara que etapas llevan puerta', async () => {
    const { body } = await api.get('/workflows/wf-full-cycle');
    const gated = body.data.stages.filter((stage) => stage.gate);

    assert.deepEqual(
      gated.map((stage) => stage.key),
      ['product-validation', 'campaign-setup', 'audience-budget'],
    );
    assert.ok(gated.every((stage) => stage.gate.question && stage.gate.approveLabel && stage.gate.rejectLabel));
  });

  it('el flujo se detiene en la puerta en lugar de terminarse', async () => {
    const started = await api.post('/workflows/wf-market-research/run');
    const runId = started.body.data.runId;

    const gated = await waitForGate(runId);

    assert.equal(gated.gate.stageKey, 'product-validation');
    assert.equal(gated.gate.kind, 'kill');
    assert.match(gated.gate.question, /seguimos adelante/i);
    assert.equal(gated.summary.blocked, 1, 'la etapa detenida se cuenta aparte');
    assert.equal(gated.summary.completed, 3, 'las anteriores si se completaron');
    assert.equal(gated.stages.find((stage) => stage.key === 'product-validation').status, 'blocked');
    assert.equal(gated.finishedAt, null);
  });

  it('aprobar la puerta hace que el flujo continue', async () => {
    const started = await api.post('/workflows/wf-market-research/run');
    const runId = started.body.data.runId;
    await waitForGate(runId);

    const approved = await api.post(`/workflows/runs/${runId}/approve`);
    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.status, 'running');
    assert.equal(approved.body.data.gate, null);
    assert.deepEqual(approved.body.data.approvedGates, ['product-validation']);

    const finished = await waitFor(
      async () => {
        const { body } = await api.get(`/workflows/runs/${runId}`);
        return body.data.status === 'completed' ? body.data : null;
      },
      { timeoutMs: 12000, message: 'el flujo no termino tras aprobar' },
    );

    assert.equal(finished.summary.completed, 4);
  });

  it('rechazar la puerta detiene el ciclo y marca lo que no se hizo', async () => {
    const started = await api.post('/workflows/wf-full-cycle/run');
    const runId = started.body.data.runId;
    await waitForGate(runId);

    const rejected = await api.post(`/workflows/runs/${runId}/reject`, { reason: 'El margen no compensa el riesgo.' });

    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.data.status, 'rejected');
    assert.equal(rejected.body.data.rejection.stageKey, 'product-validation');
    assert.equal(rejected.body.data.rejection.reason, 'El margen no compensa el riesgo.');
    assert.ok(rejected.body.data.finishedAt);

    const { body } = await api.get(`/workflows/runs/${runId}`);
    const stages = body.data.stages;

    assert.equal(stages.find((stage) => stage.key === 'product-validation').status, 'skipped');
    assert.equal(stages.filter((stage) => stage.status === 'completed').length, 4, 'el trabajo hecho se conserva');
    assert.ok(stages.filter((stage) => stage.status === 'skipped').length >= 13, 'lo pendiente se marca como omitido');
    assert.equal(body.data.summary.failed, 0, 'detenerse a proposito no es un fallo');
  });

  it('rechazar en el flujo descarta tambien la oportunidad, con el motivo', async () => {
    // Se prepara una oportunidad aprobada y se lanza su ciclo.
    const scan = await api.post('/intake/scan', { keywords: ['cosedora de papel'], mode: 'simulated' });
    const opportunityId = scan.body.data.registered[0].id;
    await api.post(`/opportunities/${opportunityId}/approve`, { reason: 'Prueba de puertas.' });

    const launched = await api.post(`/opportunities/${opportunityId}/run`);
    const runId = launched.body.data.runId;
    await waitForGate(runId);

    const rejected = await api.post(`/workflows/runs/${runId}/reject`, { reason: 'La demanda no justifica la inversion.' });

    assert.equal(rejected.body.data.discardedOpportunityId, opportunityId);

    const { body } = await api.get(`/opportunities/${opportunityId}`);
    assert.equal(body.data.status, 'discarded');
    assert.equal(body.data.decisionReason, 'La demanda no justifica la inversion.');
    assert.equal(body.data.decidedBy, 'puerta del flujo');
  });

  it('no se puede reanudar una ejecucion que espera una decision', async () => {
    const started = await api.post('/workflows/wf-market-research/run');
    const runId = started.body.data.runId;
    await waitForGate(runId);

    const resumed = await api.post(`/workflows/runs/${runId}/resume`);

    assert.equal(resumed.status, 409);
    assert.equal(resumed.body.error.details.gate, 'product-validation');
    assert.match(resumed.body.error.message, /aprueba o rechaza/i);

    await api.post(`/workflows/runs/${runId}/reject`, { reason: 'Limpieza de la prueba.' });
  });

  it('no se puede aprobar ni rechazar una ejecucion sin puerta abierta', async () => {
    const started = await api.post('/workflows/wf-market-research/run');
    const runId = started.body.data.runId;

    const approve = await api.post(`/workflows/runs/${runId}/approve`);
    assert.equal(approve.status, 409);
    assert.match(approve.body.error.message, /no esta esperando ninguna decision/i);

    const reject = await api.post(`/workflows/runs/${runId}/reject`, { reason: 'No procede.' });
    assert.equal(reject.status, 409);

    await api.post(`/workflows/runs/${runId}/pause`);
  });

  it('rechazar sin motivo esta permitido, pero con motivo corto no', async () => {
    const started = await api.post('/workflows/wf-market-research/run');
    const runId = started.body.data.runId;
    await waitForGate(runId);

    const tooShort = await api.post(`/workflows/runs/${runId}/reject`, { reason: 'no' });
    assert.equal(tooShort.status, 400);
    assert.equal(tooShort.body.error.details.field, 'reason');

    const withoutReason = await api.post(`/workflows/runs/${runId}/reject`);
    assert.equal(withoutReason.status, 200);
    assert.equal(withoutReason.body.data.status, 'rejected');
    assert.equal(withoutReason.body.data.rejection.reason, null);
  });

  it('reiniciar una ejecucion detenida vuelve a pedir la decision', async () => {
    const started = await api.post('/workflows/wf-market-research/run');
    const runId = started.body.data.runId;
    await waitForGate(runId);
    await api.post(`/workflows/runs/${runId}/approve`);

    const reset = await api.post(`/workflows/runs/${runId}/reset`);

    assert.equal(reset.status, 200);
    assert.equal(reset.body.data.status, 'running');
    assert.deepEqual(reset.body.data.approvedGates, [], 'las puertas vuelven a estar cerradas');
    assert.equal(reset.body.data.summary.completed, 0);

    // Y al llegar otra vez a la puerta, vuelve a detenerse.
    const again = await waitForGate(runId);
    assert.equal(again.gate.stageKey, 'product-validation');

    await api.post(`/workflows/runs/${runId}/reject`);
  });

  it('el buzon de notificaciones avisa cuando hay una decision pendiente', async () => {
    const started = await api.post('/workflows/wf-market-research/run');
    const runId = started.body.data.runId;
    await waitForGate(runId);

    const { body } = await api.get('/notifications?unreadOnly=true');
    assert.ok(
      body.data.some((notification) => notification.title.includes('Decision pendiente')),
      'deberia haber un aviso de decision pendiente',
    );

    await api.post(`/workflows/runs/${runId}/reject`);
  });
});
