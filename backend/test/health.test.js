/** Pruebas basicas del health check y del contrato de errores. */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startServer } from '../support/api-harness.js';

let api;

before(async () => {
  api = await startServer();
});

after(async () => {
  await api.close();
});

describe('GET /api/v1/health', () => {
  it('responde 200 con el estado del servicio', async () => {
    const { status, body } = await api.get('/health');

    assert.equal(status, 200);
    assert.equal(body.data.status, 'ok');
    assert.equal(body.data.demoMode, true);
    assert.equal(typeof body.data.uptimeSeconds, 'number');
    assert.ok(body.data.inMemory.agents > 0, 'deberia informar de los agentes en memoria');
  });

  it('incluye metadatos de demostracion en todas las respuestas', async () => {
    const { body } = await api.get('/health');

    assert.equal(body.meta.demo, true);
    assert.equal(body.meta.apiVersion, '1.0.0');
    assert.ok(body.meta.demoReferenceDate, 'deberia publicar la fecha de referencia de la demo');
    assert.ok(body.meta.pollIntervalMs > 0, 'deberia anunciar el intervalo de polling');
  });
});

describe('Contrato de errores', () => {
  it('devuelve 404 con codigo NOT_FOUND en rutas inexistentes', async () => {
    const { status, body } = await api.get('/ruta-que-no-existe');

    assert.equal(status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.ok(body.error.message.length > 0);
  });

  it('devuelve 400 y detalles cuando un parametro no es valido', async () => {
    const { status, body } = await api.get('/agents?page=0');

    assert.equal(status, 400);
    assert.equal(body.error.code, 'BAD_REQUEST');
    assert.equal(body.error.details.field, 'page');
  });

  it('no filtra detalles internos en errores desconocidos', async () => {
    const { status, body } = await api.get('/agents?status=inexistente');

    assert.equal(status, 400);
    assert.ok(!('stack' in body.error), 'la respuesta no deberia incluir la traza');
  });
});
