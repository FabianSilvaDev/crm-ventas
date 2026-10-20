/**
 * Pruebas de la cola de oportunidades y del descubrimiento de terminos.
 *
 * Se ejecutan sin red salvo el propio servidor de pruebas: para `discover` se
 * intercepta unicamente el trafico saliente y se deja pasar el local.
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

/** Sustituye las llamadas salientes y deja intactas las del propio servidor de pruebas. */
const stubOutbound = (body, status = 200, contentType = 'text/xml') => {
  const real = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('127.0.0.1')) return real(url, options);
    return new Response(body, { status, headers: { 'content-type': contentType } });
  };
  return () => {
    globalThis.fetch = real;
  };
};

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Daily Search Trends</title>
<item><title>silla ergonomica</title><ht:approx_traffic>2.000+</ht:approx_traffic>
<pubDate>Thu, 15 Oct 2026 13:00:00 -0700</pubDate><ht:picture_source>Diario</ht:picture_source>
<ht:news_item><ht:news_item_title>Noticia uno</ht:news_item_title></ht:news_item>
<ht:news_item><ht:news_item_title>Noticia dos</ht:news_item_title></ht:news_item></item>
<item><title>lampara de escritorio</title><ht:approx_traffic>500+</ht:approx_traffic></item>
</channel></rss>`;

describe('Cola de oportunidades', () => {
  it('arranca sembrada con la oportunidad que ejecuta la demostracion', async () => {
    const { status, body } = await api.get('/opportunities');

    assert.equal(status, 200);
    assert.ok(body.data.length >= 3);
    assert.equal(body.meta.filters.statuses.join(','), 'candidate,approved,discarded');

    // El artefacto `opp-0001` que referencia el flujo apunta a un registro real.
    const demo = body.data.find((item) => item.id === 'opp-0001');
    assert.ok(demo, 'deberia existir opp-0001');
    assert.equal(demo.status, 'approved');
    assert.ok(demo.latest.components.length > 0, 'la oportunidad sembrada trae su estudio');
  });

  it('ordena por puntuacion por defecto', async () => {
    const { body } = await api.get('/opportunities');
    const scores = body.data.map((item) => item.latest.score ?? -1);

    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  });

  it('cada componente lleva su fuente y su fecha', async () => {
    const { body } = await api.get('/opportunities/opp-0001');

    assert.ok(body.data.latest.components.every((component) => component.source?.id));
    assert.ok(body.data.latest.components.every((component) => component.collectedAt));
    assert.equal(body.data.latest.sourceMode, 'simulated');
  });

  it('un estudio nuevo suma una revision y no cambia el estado de la oportunidad', async () => {
    const before = await api.get('/opportunities/opp-0002');
    const previousRevision = before.body.data.revision;

    const scan = await api.post('/intake/scan', { keywords: ['teclado mecanico compacto'], mode: 'simulated' });
    assert.equal(scan.status, 200);

    const registered = scan.body.data.registered.find((item) => item.keyword === 'teclado mecanico compacto');
    assert.equal(registered.id, 'opp-0002');
    assert.equal(registered.revision, previousRevision + 1);

    const after = await api.get('/opportunities/opp-0002');
    assert.equal(after.body.data.studyCount, previousRevision + 1);
    assert.equal(after.body.data.status, 'candidate', 'estudiar no debe cambiar la decision');
    assert.ok(after.body.data.revisions.length === previousRevision + 1, 'el historial crece');
  });

  it('una decision del operador sobrevive a un estudio posterior', async () => {
    const approved = await api.post('/opportunities/opp-0003/approve', { reason: 'Margen y riesgo encajan.' });    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.status, 'approved');
    assert.equal(approved.body.data.decisionReason, 'Margen y riesgo encajan.');

    // Volver a estudiarla actualiza los datos, pero no la devuelve a la cola.
    await api.post('/intake/scan', { keywords: ['lampara de escritorio'], mode: 'simulated' });

    const after = await api.get('/opportunities/opp-0003');
    assert.equal(after.body.data.status, 'approved');
    assert.equal(after.body.data.decisionReason, 'Margen y riesgo encajan.');
  });

  it('descarta con motivo y lo deja en la trazabilidad', async () => {
    const discarded = await api.post('/opportunities/opp-0002/discard', { reason: 'Competencia demasiado alta.' });

    assert.equal(discarded.status, 200);
    assert.equal(discarded.body.data.status, 'discarded');

    const { body } = await api.get('/opportunities/summary');
    assert.ok(body.data.decisions.some((decision) => decision.id === 'opp-0002' && decision.reason === 'Competencia demasiado alta.'));
    assert.equal(body.data.totals.discarded >= 1, true);
  });

  it('se puede estudiar sin registrar, para no ensuciar la cola', async () => {
    const listBefore = await api.get('/opportunities');
    const scan = await api.post('/intake/scan', { keywords: ['webcam 4k'], mode: 'simulated', register: false });

    assert.equal(scan.status, 200);
    assert.deepEqual(scan.body.data.registered, []);

    const listAfter = await api.get('/opportunities');
    assert.equal(listAfter.body.data.length, listBefore.body.data.length);
  });

  it('filtra por estado y rechaza un estado inexistente', async () => {
    const approved = await api.get('/opportunities?status=approved');
    assert.ok(approved.body.data.every((item) => item.status === 'approved'));

    const invalid = await api.get('/opportunities?status=quizas');
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'BAD_REQUEST');
  });

  it('devuelve 404 en una oportunidad inexistente y al decidir sobre ella', async () => {
    assert.equal((await api.get('/opportunities/opp-9999')).status, 404);
    assert.equal((await api.post('/opportunities/opp-9999/approve')).status, 404);
  });
});

describe('Aclaracion del producto antes de aprobar', () => {
  it('una categoria no enlaza un producto concreto', async () => {
    const scan = await api.post('/intake/scan', { keywords: ['perifericos gamer'], mode: 'simulated' });
    const candidate = scan.body.data.candidates[0];

    assert.equal(candidate.productHypothesis.confidence, 'baja');
    assert.equal(candidate.productHypothesis.basis, 'categoria');
    assert.equal(
      candidate.catalogLink,
      null,
      'sin coincidencia fiable no se enlaza la cadena comercial de un producto que nadie ha elegido',
    );
    assert.match(candidate.productHypothesis.note, /categoria/i);

    const queue = await api.get('/opportunities?search=perifericos gamer');
    assert.ok(queue.body.data[0].productHypothesis.note.includes('ejemplo'));

    // Limpieza: la oportunidad de esta prueba no debe quedar en la cola.
    await api.post(`/opportunities/${queue.body.data[0].id}/discard`, { reason: 'Limpieza de la prueba.' });
  });

  it('no se puede aprobar una oportunidad sin saber que producto es', async () => {
    const scan = await api.post('/intake/scan', { keywords: ['accesorios de setup'], mode: 'simulated' });
    const opportunityId = scan.body.data.registered[0].id;

    const blocked = await api.post(`/opportunities/${opportunityId}/approve`, { reason: 'Me vale.' });

    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.error.code, 'CONFLICT');
    assert.equal(blocked.body.error.details.field, 'productHypothesis');
    assert.match(blocked.body.error.message, /producto concreto/i);
    // El conflicto dice exactamente cual es la situacion, para poder preguntarla.
    assert.ok(blocked.body.error.details.situation.text);

    await api.post(`/opportunities/${opportunityId}/discard`, { reason: 'Limpieza de la prueba.' });
  });

  it('aprobar indicando el producto del catalogo deja la cadena comercial enlazada', async () => {
    const scan = await api.post('/intake/scan', { keywords: ['perifericos de escritorio'], mode: 'simulated' });
    const opportunityId = scan.body.data.registered[0].id;

    const approved = await api.post(`/opportunities/${opportunityId}/approve`, {
      productId: 'prd-002',
      reason: 'Es el teclado Aurora lo que buscaba.',
    });

    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.status, 'approved');
    assert.equal(approved.body.data.productHypothesis.status, 'confirmed');
    assert.equal(approved.body.data.productHypothesis.basis, 'operador');
    assert.equal(approved.body.data.productHypothesis.productId, 'prd-002');
    assert.equal(approved.body.data.catalogLink.productId, 'prd-002');
    assert.equal(approved.body.data.catalogLink.productName, 'Teclado mecanico Aurora 75%');
  });

  it('aprobar indicando un producto fuera del catalogo no enlaza nada real', async () => {
    const scan = await api.post('/intake/scan', { keywords: ['estabilizador de camara'], mode: 'simulated' });
    const opportunityId = scan.body.data.registered[0].id;

    const approved = await api.post(`/opportunities/${opportunityId}/approve`, {
      productName: 'Estabilizador de camara para movil',
      reason: 'No esta en el catalogo, pero es lo que quiero validar.',
    });

    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.productHypothesis.name, 'Estabilizador de camara para movil');
    assert.equal(approved.body.data.catalogLink, null);
  });

  it('se puede aprobar como categoria, diciendolo explicitamente', async () => {
    const scan = await api.post('/intake/scan', { keywords: ['accesorios de mesa'], mode: 'simulated' });
    const opportunityId = scan.body.data.registered[0].id;

    const approved = await api.post(`/opportunities/${opportunityId}/approve`, {
      asCategory: true,
      reason: 'Todavia no hay producto concreto: quiero validar la categoria.',
    });

    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.productHypothesis.status, 'category');
    assert.equal(approved.body.data.catalogLink, null);
    assert.match(approved.body.data.decisionReason, /categoria/i);
  });

  it('el producto se puede aclarar sin aprobar, y un estudio posterior no lo pisa', async () => {
    const scan = await api.post('/intake/scan', { keywords: ['organizador de cables'], mode: 'simulated' });
    const opportunityId = scan.body.data.registered[0].id;

    const clarified = await api.post(`/opportunities/${opportunityId}/product`, { productId: 'prd-005' });
    assert.equal(clarified.status, 200);
    assert.equal(clarified.body.data.status, 'candidate', 'aclarar el producto no aprueba');
    assert.equal(clarified.body.data.productHypothesis.productId, 'prd-005');

    await api.post('/intake/scan', { keywords: ['organizador de cables'], mode: 'simulated' });

    const after = await api.get(`/opportunities/${opportunityId}`);
    assert.equal(after.body.data.productHypothesis.productId, 'prd-005', 'la decision del operador no se pisa');
    assert.equal(after.body.data.productHypothesis.basis, 'operador');

    await api.post(`/opportunities/${opportunityId}/discard`, { reason: 'Limpieza de la prueba.' });
  });

  it('una coincidencia fiable se puede aprobar sin escribir nada mas', async () => {
    const scan = await api.post('/intake/scan', { keywords: ['lampara de escritorio halo'], mode: 'simulated' });
    const candidate = scan.body.data.candidates[0];

    assert.equal(candidate.productHypothesis.confidence, 'alta');
    assert.equal(candidate.productHypothesis.basis, 'nombre del catalogo');

    const approved = await api.post(`/opportunities/${candidate.opportunityId}/approve`, {});
    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.status, 'approved');
  });
});

describe('Lanzar el flujo con una oportunidad aprobada', () => {
  it('rechaza lanzar una oportunidad que no esta aprobada', async () => {
    // Se registra una candidata nueva para no depender del estado que dejen otras pruebas.
    const scan = await api.post('/intake/scan', { keywords: ['cizalla de mano'], mode: 'simulated' });
    const candidate = scan.body.data.registered[0];
    assert.equal(candidate.status, 'candidate');

    const launched = await api.post(`/opportunities/${candidate.id}/run`);

    assert.equal(launched.status, 409);
    assert.equal(launched.body.error.code, 'CONFLICT');
    assert.equal(launched.body.error.details.status, 'candidate');
    assert.match(launched.body.error.message, /solo se pueden lanzar oportunidades aprobadas/i);
  });

  it('una ejecucion ligada a una oportunidad produce artefactos de ESA oportunidad', async () => {
    // opp-0001 esta aprobada y su termino corresponde a un producto del catalogo.
    const launched = await api.post('/opportunities/opp-0001/run');
    assert.equal(launched.status, 202);

    const run = launched.body.data;
    assert.equal(run.context.opportunityId, 'opp-0001');
    assert.equal(run.context.keyword, 'perifericos para estudio en casa');
    assert.ok(run.context.catalogLink.productId, 'la oportunidad esta ligada a un producto del catalogo');

    const advanced = await waitFor(
      async () => {
        const { body } = await api.get(`/workflows/runs/${run.runId}`);
        return body.data.stages[0].status === 'completed' ? body.data : null;
      },
      { timeoutMs: 8000, message: 'la primera etapa no llego a completarse' },
    );

    const first = advanced.stages[0];
    assert.equal(first.key, 'opportunity');
    // El artefacto es la propia oportunidad, no el texto fijo de la plantilla.
    assert.equal(first.result.artifacts[0].type, 'opportunity');
    assert.equal(first.result.artifacts[0].id, 'opp-0001');
    // Y las metricas salen de su estudio registrado.
    assert.ok(first.result.metrics.some((metric) => metric.label === 'Puntuacion'));

    await api.post(`/workflows/runs/${run.runId}/pause`);
  });

  it('la etapa de investigacion consulta las fuentes y deja un informe real', async () => {
    // Se estudia un termino que no existe en el catalogo y se aprueba.
    const scan = await api.post('/intake/scan', { keywords: ['grapadora de sobremesa'], mode: 'simulated', register: false });
    const candidate = scan.body.data.candidates[0];
    assert.equal(candidate.catalogLink, null, 'no deberia tener enlace con el catalogo');

    await api.post('/intake/scan', { keywords: ['grapadora de sobremesa'], mode: 'simulated' });
    const queue = await api.get('/opportunities?search=grapadora');
    const opportunity = queue.body.data[0];
    await api.post(`/opportunities/${opportunity.id}/approve`, {
      reason: 'Prueba de investigacion real.',
      productName: 'Grapadora de sobremesa',
    });

    const launched = await api.post(`/opportunities/${opportunity.id}/run`);
    assert.equal(launched.status, 202);
    assert.equal(launched.body.data.context.catalogLink, null);

    const advanced = await waitFor(
      async () => {
        const { body } = await api.get(`/workflows/runs/${launched.body.data.runId}`);
        return body.data.stages[0].status === 'completed' ? body.data : null;
      },
      { timeoutMs: 8000 },
    );

    // La etapa 1 apunta al registro real de la oportunidad.
    const first = advanced.stages[0].result.artifacts[0];
    assert.equal(first.id, opportunity.id);
    assert.equal(first.derived, false);

    // La etapa 2 ya no es texto fijo: consulta las fuentes y registra un informe.
    const withResearch = await waitFor(
      async () => {
        const { body } = await api.get(`/workflows/runs/${launched.body.data.runId}`);
        return body.data.stages[1]?.status === 'completed' ? body.data : null;
      },
      { timeoutMs: 10000, message: 'la etapa 2 no llego a completarse' },
    );

    const artifact = withResearch.stages[1].result.artifacts[0];
    assert.equal(artifact.type, 'research');
    assert.equal(artifact.derived, false, 'el informe existe: se ha generado y registrado');
    assert.match(artifact.id, /^rsc-1/, 'es un informe generado, no uno de la demo');
    assert.match(withResearch.stages[1].result.summary, /grapadora de sobremesa/);

    // Y el informe se puede consultar, con su origen y sus limitaciones.
    const report = await api.get(`/research/${artifact.id}`);
    assert.equal(report.status, 200);
    assert.equal(report.body.data.origin, 'run');
    assert.equal(report.body.data.opportunityId, opportunity.id);
    assert.ok(report.body.data.findings.length > 0, 'el informe trae hallazgos');
    assert.ok(report.body.data.limitations.length > 0, 'y declara lo que no se pudo conseguir');

    const listed = await api.get('/research?search=grapadora');
    assert.ok(
      listed.body.data.some((item) => item.id === artifact.id),
      'el informe generado aparece en la vista de investigacion',
    );

    // Una etapa posterior, sin producto en el catalogo, si propone un artefacto derivado.
    const withValidation = await waitFor(
      async () => {
        const { body } = await api.get(`/workflows/runs/${launched.body.data.runId}`);
        return body.data.stages[4]?.status === 'completed' ? body.data : null;
      },
      { timeoutMs: 12000, message: 'la etapa 5 no llego a completarse' },
    );
    assert.equal(withValidation.stages[4].result.artifacts[0].derived, true);

    await api.post(`/workflows/runs/${launched.body.data.runId}/pause`);
  });

  it('tambien se puede lanzar pasando la oportunidad al flujo', async () => {
    const launched = await api.post('/workflows/wf-market-research/run', { opportunityId: 'opp-0001' });

    assert.equal(launched.status, 202);
    assert.equal(launched.body.data.workflowId, 'wf-market-research');
    assert.equal(launched.body.data.context.opportunityId, 'opp-0001');

    await api.post(`/workflows/runs/${launched.body.data.runId}/pause`);
  });

  it('una ejecucion sin oportunidad mantiene el caso de demostracion', async () => {
    const launched = await api.post('/workflows/wf-market-research/run');

    assert.equal(launched.status, 202);
    assert.equal(launched.body.data.context, null);

    await api.post(`/workflows/runs/${launched.body.data.runId}/pause`);
  });
});

describe('Descubrimiento de terminos (Google Trends)', () => {
  it('devuelve los terminos que suben, con su trafico', async () => {
    const restore = stubOutbound(RSS);

    try {
      const { status, body } = await api.get('/intake/discover?geo=ES&limit=5');

      assert.equal(status, 200);
      assert.equal(body.data.terms.length, 2);
      assert.equal(body.data.terms[0].title, 'silla ergonomica');
      assert.equal(body.data.terms[0].traffic, '2.000+');
      assert.equal(body.data.terms[0].trafficValue, 2000);
      assert.equal(body.data.terms[0].newsTitles.length, 2);
      assert.equal(body.data.source.id, 'google-trends');
      // La advertencia sobre el tipo de contenido viaja con los datos.
      assert.match(body.data.caveat, /actualidad, no de demanda comercial/);
    } finally {
      restore();
    }
  });

  it('avisa en lugar de fallar cuando el feed no responde', async () => {
    const restore = stubOutbound('Error 429', 429, 'text/html');

    try {
      const { status, body } = await api.get('/intake/discover');

      assert.equal(status, 200);
      assert.deepEqual(body.data.terms, []);
      assert.ok(body.data.error.message.includes('429'));
    } finally {
      restore();
    }
  });

  it('valida la geografia', async () => {
    const { status, body } = await api.get('/intake/discover?geo=ESPANA');

    assert.equal(status, 400);
    assert.equal(body.error.details.field, 'geo');
  });
});
