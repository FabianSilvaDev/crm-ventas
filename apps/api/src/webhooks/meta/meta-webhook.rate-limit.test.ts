import type { AddressInfo } from 'node:net';

import { Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.factory.js';
import { loadEnv } from '../../config/env.js';
import { InMemoryRateLimiter } from '../../common/rate-limit/in-memory-rate-limiter.js';

/**
 * Pruebas del límite de peticiones, **en un fichero aparte a propósito**.
 *
 * El limitador es un contador en memoria del proceso, y Vitest ejecuta cada fichero en su propio
 * proceso: aquí se puede bajar el límite a 3 y agotarlo sin arrastrar al resto de las pruebas del
 * webhook, que viven en `meta-webhook.controller.test.ts` con el límite por defecto.
 */
const VERIFY_TOKEN = 'token-de-verificacion-de-pruebas';
const LIMITE = 3;

const TEST_ENV = loadEnv({
  META_APP_SECRET: 'secreto-de-meta-para-las-pruebas-de-rate-limit',
  META_VERIFY_TOKEN: VERIFY_TOKEN,
  PUBLIC_RATE_LIMIT_PER_MINUTE: String(LIMITE),
});

let app: INestApplication;
let base: string;

const RUTA = `/api/v1/webhooks/meta?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1`;

interface Respuesta {
  readonly status: number;
  readonly retryAfter: string | null;
  readonly body: Record<string, unknown> | undefined;
}

async function pedir(): Promise<Respuesta> {
  const res = await fetch(base + RUTA);
  const texto = await res.text();

  return {
    status: res.status,
    retryAfter: res.headers.get('retry-after'),
    body: texto === '' ? undefined : (JSON.parse(texto) as Record<string, unknown>),
  };
}

beforeAll(async () => {
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
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

describe('límite de peticiones en el endpoint público', () => {
  it('deja pasar hasta el límite y responde 429 a partir de ahí', async () => {
    const respuestas = [];

    for (let i = 0; i < LIMITE + 1; i += 1) {
      respuestas.push(await pedir());
    }

    expect(respuestas.slice(0, LIMITE).map((r) => r.status)).toEqual([200, 200, 200]);

    const bloqueada = respuestas[LIMITE];
    expect(bloqueada?.status).toBe(429);
    expect(bloqueada?.body).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', status: 429 });
  });

  it('incluye Retry-After, para que el cliente sepa cuánto esperar', async () => {
    // El filtro de errores no emite esta cabecera (solo construye el cuerpo), así que la pone el
    // guard. Sin ella, Meta reintentaría a ciegas.
    const res = await pedir();

    expect(res.status).toBe(429);
    expect(Number(res.retryAfter)).toBeGreaterThan(0);
    expect(Number(res.retryAfter)).toBeLessThanOrEqual(60);
  });
});

describe('InMemoryRateLimiter', () => {
  it('reinicia la ventana cuando pasa el minuto', () => {
    // Con el reloj inyectado se prueba el reinicio sin esperar sesenta segundos de verdad.
    let ahora = 1_000_000;
    const limitador = new InMemoryRateLimiter(2, () => ahora);

    expect(limitador.check('ip').allowed).toBe(true);
    expect(limitador.check('ip').allowed).toBe(true);
    expect(limitador.check('ip').allowed).toBe(false);

    ahora += 60_001;

    expect(limitador.check('ip').allowed).toBe(true);
  });

  it('cuenta por clave: agotar una no afecta a las demás', () => {
    const limitador = new InMemoryRateLimiter(1, () => 1_000_000);

    expect(limitador.check('ip-a').allowed).toBe(true);
    expect(limitador.check('ip-a').allowed).toBe(false);
    expect(limitador.check('ip-b').allowed).toBe(true);
  });

  it('informa de cuánto falta para el reinicio', () => {
    const limitador = new InMemoryRateLimiter(1, () => 1_000_000);

    limitador.check('ip');
    const decision = limitador.check('ip');

    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
    expect(decision.retryAfterSeconds).toBe(60);
  });

  it('consume también las peticiones denegadas, para que insistir no reabra la ventana', () => {
    const limitador = new InMemoryRateLimiter(1, () => 1_000_000);

    limitador.check('ip');
    for (let i = 0; i < 50; i += 1) {
      expect(limitador.check('ip').allowed).toBe(false);
    }
  });
});
