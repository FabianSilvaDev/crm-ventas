/** Pruebas de agentes: listado, filtros, detalle y ejecucion de tareas simuladas. */
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

describe('GET /api/v1/agents', () => {
  it('devuelve la plantilla completa de agentes con metadatos de paginacion', async () => {
    const { status, body } = await api.get('/agents');

    assert.equal(status, 200);
    assert.ok(body.data.length >= 20, 'deberia estar la plantilla completa de agentes');
    assert.equal(body.meta.total, body.data.length);
    assert.ok(body.meta.pageSize >= body.data.length);
  });

  it('Yanca es la responsable de la etapa de oportunidad', async () => {
    const { body } = await api.get('/agents?search=yanca');

    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].name, 'Yanca');
    assert.equal(body.data[0].specialty, 'Intake de oportunidades');

    const { body: workflow } = await api.get('/workflows/wf-full-cycle');
    const opportunity = workflow.data.stages[0];

    assert.equal(opportunity.key, 'opportunity');
    assert.equal(opportunity.agentIds[0], body.data[0].id);
    assert.equal(opportunity.agents[0].name, 'Yanca');
  });

  it('cada agente incluye departamento, avatar y estado', async () => {
    const { body } = await api.get('/agents');
    const agent = body.data[0];

    assert.ok(agent.department.id, 'el agente deberia traer su departamento');
    assert.ok(agent.avatar.body && agent.avatar.palette, 'el avatar procedural deberia estar completo');
    assert.ok(typeof agent.progress === 'number');
  });

  it('filtra por estado', async () => {
    const { body } = await api.get('/agents?status=working');

    assert.ok(body.data.length > 0, 'deberia haber agentes trabajando');
    assert.ok(body.data.every((agent) => agent.status === 'working'));
  });

  it('filtra por departamento y busca por nombre', async () => {
    const byDepartment = await api.get('/agents?departmentId=research-lab');
    assert.ok(byDepartment.body.data.every((agent) => agent.department.id === 'research-lab'));

    const bySearch = await api.get('/agents?search=scout');
    assert.equal(bySearch.body.data.length, 1);
    assert.equal(bySearch.body.data[0].name, 'SCOUT');
  });

  it('rechaza un estado inexistente con 400', async () => {
    const { status, body } = await api.get('/agents?status=dormido');

    assert.equal(status, 400);
    assert.equal(body.error.code, 'BAD_REQUEST');
  });
});

describe('GET /api/v1/agents/:id', () => {
  it('devuelve el detalle de un agente existente', async () => {
    const { status, body } = await api.get('/agents/agt-001');

    assert.equal(status, 200);
    assert.equal(body.data.id, 'agt-001');
    assert.equal(body.data.name, 'NEXUS');
    assert.ok(Array.isArray(body.data.capabilities));
  });

  it('devuelve 404 si el agente no existe', async () => {
    const { status, body } = await api.get('/agents/agt-999');

    assert.equal(status, 404);
    assert.match(body.error.message, /agt-999/);
  });
});

describe('POST /api/v1/agents/:id/run', () => {
  it('acepta la tarea (202) y la completa en segundo plano', async () => {
    const started = await api.post('/agents/agt-008/run', { title: 'Programar la semana 42' });

    assert.equal(started.status, 202);
    assert.equal(started.body.data.status, 'running');
    assert.equal(started.body.data.agentId, 'agt-008');

    const taskId = started.body.data.id;
    const agentWhileRunning = await api.get('/agents/agt-008');
    assert.equal(agentWhileRunning.body.data.status, 'working');
    assert.equal(agentWhileRunning.body.data.currentTask.id, taskId);

    const finished = await waitFor(
      async () => {
        const { body } = await api.get(`/agents/tasks/${taskId}`);
        return body.data.status === 'completed' ? body.data : null;
      },
      { message: 'la tarea del agente no termino a tiempo' },
    );

    assert.ok(finished.result.summary, 'la tarea deberia devolver un resultado');
    assert.ok(finished.result.metrics.length > 0);

    const finalAgent = await api.get('/agents/agt-008');
    assert.equal(finalAgent.body.data.status, 'completed');
    assert.equal(finalAgent.body.data.currentTask, null);
    assert.equal(finalAgent.body.data.recentResult.summary, finished.result.summary);
  });

  it('registra la tarea en la actividad reciente', async () => {
    const { body } = await api.get('/activity?type=task_started');

    assert.ok(body.data.length > 0);
    assert.ok(body.data.some((event) => event.type === 'task_started' && event.actor));
  });

  it('devuelve 404 al ejecutar sobre un agente inexistente', async () => {
    const { status } = await api.post('/agents/agt-999/run', {});
    assert.equal(status, 404);
  });
});
