import type { AddressInfo } from 'node:net';

import { Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { createApp } from '../../app.factory.js';
import { loadEnv } from '../../config/env.js';
import { respuestaDe } from './meta-webhook.controller.js';
import { computeMetaSignature, META_SIGNATURE_HEADER } from './meta-signature.js';

const SECRET = 'secreto-de-meta-para-las-pruebas-de-integracion';
const VERIFY_TOKEN = 'token-de-verificacion-de-pruebas';

/**
 * Estas pruebas hablan con **la aplicación real** (`createApp`), escuchando en un puerto efímero, con
 * su prefijo global, su middleware de traza, su pipe de validación, sus guards y su filtro de
 * errores. No se imita ningún trozo del pipeline: si algo se olvida registrar, aquí se nota.
 *
 * El límite de peticiones se deja en su valor por defecto: agotarlo es **otra prueba, en otro
 * fichero**, porque el limitador es un contador por proceso y consumirlo aquí dejaría al resto de
 * estas pruebas recibiendo 429.
 */
const TEST_ENV = loadEnv({
  META_APP_SECRET: SECRET,
  META_VERIFY_TOKEN: VERIFY_TOKEN,
});

const CAMBIOS_VALIDOS = [
  {
    field: 'leadgen',
    value: { leadgen_id: 'lead-1', form_id: '999', ad_id: '111', campaign_id: '333' },
  },
];

function sobre(cambios: unknown, object = 'page'): string {
  return JSON.stringify({
    object,
    entry: [{ id: 'pagina-1', time: 1759324951, changes: cambios }],
  });
}

let app: INestApplication;
let base: string;
let warnSpy: MockInstance;

interface Respuesta {
  readonly status: number;
  readonly contentType: string;
  readonly texto: string;
  readonly retryAfter: string | null;
  readonly traceId: string | null;
  readonly body: Record<string, unknown> | undefined;
}

async function pedir(path: string, init?: RequestInit): Promise<Respuesta> {
  const res = await fetch(`${base}${path}`, init);
  const texto = await res.text();

  return {
    status: res.status,
    contentType: res.headers.get('content-type') ?? '',
    texto,
    retryAfter: res.headers.get('retry-after'),
    traceId: res.headers.get('x-trace-id'),
    body: texto === '' ? undefined : intentarJson(texto),
  };
}

function intentarJson(texto: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(texto) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

async function publicar(cuerpo: string, firma?: string): Promise<Respuesta> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (firma !== undefined) {
    headers[META_SIGNATURE_HEADER] = firma;
  }

  return pedir('/api/v1/webhooks/meta', { method: 'POST', headers, body: cuerpo });
}

/** Firma con el secreto de verdad, igual que lo haría Meta. */
function firmar(cuerpo: string): string {
  return computeMetaSignature(Buffer.from(cuerpo, 'utf8'), SECRET);
}

beforeAll(async () => {
  // Los guards y el filtro registran; se silencia y se captura a la vez.
  warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

  app = await createApp(TEST_ENV, { shutdownHooks: false });
  await app.listen(0, '127.0.0.1');

  const { port } = app.getHttpServer().address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.close();
  vi.restoreAllMocks();
});

describe('GET /api/v1/webhooks/meta — handshake', () => {
  it('devuelve el challenge en crudo cuando el token coincide', async () => {
    const res = await pedir(
      `/api/v1/webhooks/meta?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1234567890`,
    );

    expect(res.status).toBe(200);
    // `text/plain`: es literalmente lo que Meta compara, y evita que un valor reflejado se
    // interprete como HTML en algún eslabón intermedio.
    expect(res.contentType).toBe('text/plain; charset=utf-8');
    expect(res.texto).toBe('1234567890');
  });

  it('rechaza con 403 cuando el token no coincide', async () => {
    const res = await pedir(
      '/api/v1/webhooks/meta?hub.mode=subscribe&hub.verify_token=token-equivocado&hub.challenge=123',
    );

    expect(res.status).toBe(403);
    expect(res.contentType).toBe('application/problem+json; charset=utf-8');
    expect(res.body).toMatchObject({ code: 'FORBIDDEN_PERMISSION' });
    // El token recibido no se refleja en la respuesta.
    expect(res.texto).not.toContain('token-equivocado');
  });

  it('rechaza un modo distinto de `subscribe` aunque el token sea correcto', async () => {
    const res = await pedir(
      `/api/v1/webhooks/meta?hub.mode=unsubscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=123`,
    );

    expect(res.status).toBe(403);
  });

  it('no devuelve el challenge truncado a medias ni más largo de lo permitido', async () => {
    const largo = 'x'.repeat(500);
    const res = await pedir(
      `/api/v1/webhooks/meta?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=${largo}`,
    );

    expect(res.status).toBe(200);
    expect(res.texto).toHaveLength(256);
  });

  it('exige los tres parámetros del handshake', async () => {
    const res = await pedir(`/api/v1/webhooks/meta?hub.mode=subscribe`);

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('pone X-Trace-Id también en las respuestas correctas', async () => {
    const res = await pedir(
      `/api/v1/webhooks/meta?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1`,
    );

    expect(res.traceId).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('POST /api/v1/webhooks/meta — entrega', () => {
  it('acepta un sobre firmado y con un lead dentro', async () => {
    const cuerpo = sobre(CAMBIOS_VALIDOS);
    const res = await publicar(cuerpo, firmar(cuerpo));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it('responde 200 con `ignored` cuando el sobre no trae nada de `leadgen`', async () => {
    // Un evento firmado pero que no nos incumbe NO es un error: `docs/api.md` §8.4 prohíbe el 4xx
    // aquí porque Meta lo reintentaría indefinidamente.
    const cuerpo = sobre([{ field: 'feed', value: { item: 'comentario' } }]);
    const res = await publicar(cuerpo, firmar(cuerpo));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, ignored: true });
  });

  it('responde 200 con `ignored` para un sobre de otro tipo de objeto', async () => {
    const cuerpo = sobre(CAMBIOS_VALIDOS, 'instagram');
    const res = await publicar(cuerpo, firmar(cuerpo));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, ignored: true });
  });

  it('ignora un cambio `leadgen` sin `leadgen_id` en vez de fallar', async () => {
    const cuerpo = sobre([{ field: 'leadgen', value: { form_id: 'sin-leadgen-id' } }]);
    const res = await publicar(cuerpo, firmar(cuerpo));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, ignored: true });
  });

  it('rechaza con 401 la firma de un cuerpo DISTINTO', async () => {
    // La prueba central de que se firma el crudo: si el guard recalculara sobre el objeto
    // parseado (o sobre `JSON.stringify(req.body)`), esta petición pasaría.
    const res = await publicar(sobre(CAMBIOS_VALIDOS), firmar('{"object":"page","entry":[]}'));

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: 'WEBHOOK_SIGNATURE_INVALID' });
  });

  it('rechaza con 401 un cuerpo sin firma', async () => {
    expect((await publicar(sobre(CAMBIOS_VALIDOS))).status).toBe(401);
  });

  it('rechaza con 422 un sobre firmado pero estructuralmente inválido', async () => {
    // Firmado de verdad (Meta podría mandar algo así tras un cambio suyo), pero sin `entry`.
    const cuerpo = JSON.stringify({ object: 'page' });
    const res = await publicar(cuerpo, firmar(cuerpo));

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

describe('respuestaDe', () => {
  // Esta rama no se puede alcanzar por HTTP en esta rebanada: el doble de desarrollo siempre
  // devuelve `stored`. Se prueba aquí para que no llegue sin cubrir al Hito 2, cuando la ingesta real
  // empiece a devolver `duplicate` de verdad.
  it('marca `duplicate` solo cuando TODO lo recibido ya lo teníamos', () => {
    expect(respuestaDe(['duplicate'])).toEqual({ received: true, duplicate: true });
    expect(respuestaDe(['duplicate', 'duplicate'])).toEqual({ received: true, duplicate: true });
  });

  it('no marca `duplicate` si algo entró de nuevo', () => {
    expect(respuestaDe(['stored'])).toEqual({ received: true });
    expect(respuestaDe(['duplicate', 'stored'])).toEqual({ received: true });
  });

  it('nunca responde un error: un duplicado no es un fallo', () => {
    // Si esto devolviera un 409, Meta reintentaría justo lo que ya tenemos —y peor: leería el fallo
    // como nuestro, no suyo.
    const respuesta = respuestaDe(['duplicate']);

    expect(respuesta).toEqual({ received: true, duplicate: true });
    expect(respuesta).not.toHaveProperty('error');
  });
});

describe('límite de peticiones', () => {
  it('no estorba con el límite por defecto a un uso normal', async () => {
    // El correlato del fichero vecino `meta-webhook.rate-limit.test.ts`, que sí agota el límite: aquí
    // se comprueba que una ráfaga corta y legítima —varias peticiones seguidas de la misma IP— pasa
    // sin tropezar. Un límite que estorba al tráfico bueno es un límite mal puesto.
    const ruta = `/api/v1/webhooks/meta?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1`;

    for (let i = 0; i < 10; i += 1) {
      expect((await pedir(ruta)).status).toBe(200);
    }
  });
});
