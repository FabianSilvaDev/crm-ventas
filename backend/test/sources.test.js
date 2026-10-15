/**
 * Pruebas de las fuentes de datos y del estudio de oportunidad.
 *
 * No salen a la red: trabajan con respuestas de ejemplo y con el modo `simulated`, de
 * modo que se pueden ejecutar sin credenciales y sin depender de que Google o
 * AliExpress respondan hoy.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startServer } from '../support/api-harness.js';
import { extractProducts, profiles, signTopMd5 } from '../src/sources/alibaba-group.source.js';
import { fetchInterest, momentumFrom, resolveTopics } from '../src/sources/google-trends.source.js';
import { createSignal, median } from '../src/sources/signal.js';
import { collectSignals, listSources } from '../src/sources/index.js';
import { buildCandidate } from '../src/services/intake.service.js';
import { config } from '../src/config.js';

let api;

before(async () => {
  api = await startServer();
});

after(async () => {
  await api.close();
});

describe('Firma de la Open Platform (Alibaba / AliExpress)', () => {
  it('ordena los parametros y firma con md5 en mayusculas', () => {
    const params = {
      app_key: 'demo-key',
      method: 'aliexpress.affiliate.product.query',
      timestamp: '1750000000000',
      sign_method: 'md5',
      format: 'json',
      v: '2.0',
      keywords: 'teclado',
      page_size: '20',
    };

    // Valor calculado con el algoritmo documentado: md5(secreto + claves ordenadas + secreto).
    assert.equal(signTopMd5(params, 'demo-secret'), 'F031F9129CDD397D71F5679BAB17BDC6');
  });

  it('el orden de entrada no cambia la firma y los parametros vacios se ignoran', () => {
    const secret = 'demo-secret';
    const a = signTopMd5({ b: '2', a: '1' }, secret);
    const b = signTopMd5({ a: '1', b: '2', vacio: '', nulo: null }, secret);

    assert.equal(a, b);
  });
});

describe('Google Trends', () => {
  const realFetch = globalThis.fetch;

  after(() => {
    globalThis.fetch = realFetch;
  });

  /** Sustituye `fetch` por respuestas preparadas, para probar el analisis sin red. */
  const stubFetch = (responses) => {
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      const body = responses.shift();
      if (body === undefined) throw new Error(`Llamada inesperada: ${url}`);
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
    };
    return calls;
  };

  it('resuelve un termino a temas y marca la coincidencia exacta', async () => {
    stubFetch([
      `)]}',\n{"default":{"topics":[{"mid":"/g/122l35w1","title":"teclado mecanico"},{"mid":"/m/057cc","title":"Teclado (instrumento musical)"}]}}`,
    ]);

    const topics = await resolveTopics('teclado mecanico');

    assert.equal(topics.length, 2);
    assert.equal(topics[0].mid, '/g/122l35w1');
    assert.equal(topics[0].exact, true);
    assert.equal(topics[1].exact, false);
  });

  it('lee la serie de interes encadenando exploracion y widget', async () => {
    const calls = stubFetch([
      // 1) exploracion: devuelve el widget con su token y su peticion
      JSON.stringify({
        widgets: [{ id: 'TIMESERIES', token: 'TOKEN-123', request: { time: 'today 12-m', resolution: 'WEEK' } }],
      }),
      // 2) widget: la serie temporal
      `)]}',\n{"default":{"timelineData":[{"formattedTime":"1 ene","value":[40]},{"formattedTime":"8 ene","value":[62]}]}}`,
    ]);

    const { points } = await fetchInterest('teclado mecanico');

    assert.equal(points.length, 2);
    assert.equal(points[0].value, 40);
    assert.equal(points[1].at, '8 ene');
    assert.equal(calls.length, 2, 'deberia hacer exactamente dos llamadas');
    assert.ok(calls[1].includes('token=TOKEN-123'), 'la segunda llamada necesita el token del widget');
  });

  it('falla con un error explicito si la exploracion no trae serie', async () => {
    stubFetch([JSON.stringify({ widgets: [{ id: 'GEO_MAP' }] })]);

    await assert.rejects(() => fetchInterest('teclado'), /no ha devuelto una serie/);
  });

  it('propaga el motivo cuando la fuente limita las peticiones', async () => {
    globalThis.fetch = async () => new Response('Error 429 (Too Many Requests)', { status: 429 });

    await assert.rejects(
      () => fetchInterest('teclado'),
      (error) => {
        assert.equal(error.status, 429);
        assert.equal(error.retryable, true);
        assert.match(error.hint, /limitando las peticiones/);
        return true;
      },
    );
  });
});

describe('Normalizacion de respuestas', () => {
  it('extrae productos y total de la respuesta del programa de afiliados', () => {
    const payload = {
      aliexpress_affiliate_product_query_response: {
        resp_result: {
          resp_code: 200,
          result: {
            total_record_count: 342,
            products: [{ product_title: 'Teclado 75%', target_sale_price: '45.90' }],
          },
        },
      },
    };

    const { products, total } = extractProducts(payload);
    assert.equal(products.length, 1);
    assert.equal(total, 342);
  });

  it('devuelve una lista vacia cuando la respuesta no trae productos', () => {
    const { products, total } = extractProducts({ resultado: 'inesperado' });
    assert.deepEqual(products, []);
    assert.equal(total, null);
  });

  it('la mediana resiste valores atipicos y descarta lo que no es numero', () => {
    assert.equal(median([10, 12, 11, 900, null, 'x']), 11.5);
    assert.equal(median([]), null);
  });

  it('calcula la tendencia comparando los dos ultimos tramos', () => {
    const points = [10, 10, 10, 20, 20, 20].map((value) => ({ value }));
    assert.equal(momentumFrom(points, 3), 100);
    assert.equal(momentumFrom([{ value: 5 }], 3), null);
  });
});

describe('Modelo de señal', () => {
  it('toma la unidad y la etiqueta del catalogo de metricas', () => {
    const signal = createSignal({ keyword: 'teclado', metric: 'demand', value: 74.126 });

    assert.equal(signal.metricLabel, 'Demanda');
    assert.equal(signal.unit, 'indice 0-100');
    assert.equal(signal.value, 74.13);
  });

  it('una señal parcial no lleva procedencia: la sella el registro', () => {
    const signal = createSignal({ keyword: 'teclado', metric: 'demand', value: 10 });

    assert.equal('source' in signal, false);
    assert.equal('collectedAt' in signal, false);
  });
});

describe('Registro de fuentes', () => {
  it('declara las plataformas sin credenciales como no disponibles, con su motivo', () => {
    const sources = listSources();
    const aliexpress = sources.find((source) => source.id === 'aliexpress');

    assert.ok(aliexpress);
    assert.equal(aliexpress.requiresCredentials, true);
    assert.equal(aliexpress.mode, 'live');
    if (!config.aliexpress.appKey) {
      assert.equal(aliexpress.available, false);
      assert.match(aliexpress.unavailableReason, /ALIEXPRESS_APP_KEY/);
      assert.ok(aliexpress.setupHint, 'deberia explicar como conseguir las credenciales');
    }
  });

  it('en modo simulado no sale a la red y marca todas las señales', async () => {
    const collection = await collectSignals({ keywords: ['teclado mecanico'], mode: 'simulated' });

    assert.ok(collection.signals.length > 0);
    assert.ok(collection.signals.every((signal) => signal.source.mode === 'simulated'));
    assert.ok(collection.signals.every((signal) => signal.collectedAt), 'toda señal lleva fecha de recogida');
    assert.ok(collection.signals.every((signal) => signal.confidence <= 0.2), 'un dato simulado no puede ir con alta confianza');
  });

  it('los perfiles de plataforma declaran su papel (compra o venta)', () => {
    const { aliexpress, alibaba } = profiles(config);

    assert.equal(aliexpress.role, 'buyer');
    assert.equal(alibaba.role, 'buyer');
    assert.equal(alibaba.methodInPath, true, 'Alibaba lleva el metodo en la ruta');
    assert.equal(aliexpress.methodInPath, false);
  });
});

describe('Estudio de oportunidad', () => {
  const signalFor = (metric, value, confidence = 0.6) => {
    const signal = createSignal({ keyword: 'teclado', metric, value, confidence });
    return [metric, { ...signal, source: { id: 'test', name: 'Prueba', kind: 'public', mode: 'live' }, collectedAt: new Date().toISOString() }];
  };

  it('calcula margen, cobertura y veredicto cuando estan los datos', () => {
    const candidate = buildCandidate(
      'teclado',
      new Map([signalFor('demand', 80), signalFor('cost', 45), signalFor('price', 109), signalFor('competition', 120), signalFor('salesVolume', 300), signalFor('momentum', 15)]),
      { minMargin: 0.3, maxCost: 60, maxCompetition: 500, expectedSalePrice: null },
    );

    assert.equal(candidate.economics.margin, 0.59);
    assert.equal(candidate.coverage, 1);
    assert.equal(candidate.verdict, 'cumple');
    assert.equal(candidate.missing.length, 0);
    assert.ok(candidate.score > 50 && candidate.score <= 100);
  });

  it('sin coste no hay margen: lo declara en vez de inventarlo', () => {
    const candidate = buildCandidate(
      'teclado',
      new Map([signalFor('demand', 80), signalFor('competition', 40)]),
      { minMargin: 0.3, maxCost: null, maxCompetition: null, expectedSalePrice: null },
    );

    assert.equal(candidate.economics.margin, null);
    assert.ok(candidate.missing.some((entry) => entry.metric === 'margin'));
    assert.ok(candidate.missing.some((entry) => entry.metric === 'cost'));
    assert.ok(candidate.coverage < 1, 'la cobertura debe reflejar que faltan datos');
    assert.equal(candidate.checks.find((check) => check.constraint === 'minMargin').passed, null);
  });

  it('usa el precio de venta indicado y lo marca como supuesto', () => {
    const candidate = buildCandidate('teclado', new Map([signalFor('cost', 40)]), {
      minMargin: 0.3,
      maxCost: null,
      maxCompetition: null,
      expectedSalePrice: 100,
    });

    assert.equal(candidate.economics.margin, 0.6);
    assert.equal(candidate.economics.marginAssumed, true);
    assert.ok(candidate.components.find((component) => component.metric === 'margin').confidence <= 0.4);
  });
});

describe('API del estudio de oportunidad', () => {
  it('GET /sources describe cada fuente y el modo vigente', async () => {
    const { status, body } = await api.get('/sources');

    assert.equal(status, 200);
    assert.ok(['auto', 'live', 'simulated'].includes(body.data.mode));
    assert.ok(body.data.sources.some((source) => source.id === 'google-trends'));
    assert.ok(body.data.sources.some((source) => source.id === 'aliexpress'));
    assert.ok(body.data.sources.every((source) => typeof source.limitations === 'string'));
  });

  it('POST /intake/scan devuelve candidatas puntuadas con la procedencia de cada dato', async () => {
    const { status, body } = await api.post('/intake/scan', {
      keywords: ['teclado mecanico', 'soporte de monitor'],
      mode: 'simulated',
      constraints: { minMargin: 0.25 },
    });

    assert.equal(status, 200);
    assert.equal(body.data.candidates.length, 2);
    assert.ok(body.data.candidates[0].score !== null);
    assert.ok(body.data.candidates[0].components.length > 0);
    assert.ok(
      body.data.candidates[0].components.every((component) => component.source?.id && component.collectedAt),
      'cada componente debe decir de donde sale',
    );
    assert.ok(body.data.sources.length > 0);
    assert.equal(body.data.mode, 'simulated');
  });

  it('ordena las candidatas por puntuacion', async () => {
    const { body } = await api.post('/intake/scan', { keywords: ['silla', 'lampara', 'webcam'], mode: 'simulated' });
    const scores = body.data.candidates.map((candidate) => candidate.score ?? -1);

    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  });

  it('rechaza un estudio sin terminos o con demasiados', async () => {
    const withoutKeywords = await api.post('/intake/scan', { keywords: [] });
    assert.equal(withoutKeywords.status, 400);
    assert.equal(withoutKeywords.body.error.code, 'BAD_REQUEST');

    const tooMany = await api.post('/intake/scan', { keywords: Array.from({ length: 9 }, (_, i) => `t${i}`) });
    assert.equal(tooMany.status, 400);
    assert.equal(tooMany.body.error.details.max, 8);
  });

  it('rechaza restricciones imposibles', async () => {
    const { status, body } = await api.post('/intake/scan', { keywords: ['teclado'], constraints: { minMargin: 4 } });

    assert.equal(status, 400);
    assert.equal(body.error.details.field, 'minMargin');
  });
});
