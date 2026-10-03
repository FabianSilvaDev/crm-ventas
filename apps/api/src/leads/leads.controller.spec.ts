import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AddressInfo } from 'node:net';
import { rm } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApp } from '../app.factory.js';
import type { Env } from '../config/env.js';

const DEV_API_TOKEN = 'dev-token-valido-12345';

function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 0,
    LOG_LEVEL: 'error',
    WEB_ORIGIN: 'http://localhost:4200',
    META_APP_SECRET: 'dev-secret-1234567890123456',
    META_VERIFY_TOKEN: 'dev-verify-1234567890123456',
    META_GRAPH_MODE: 'fixture',
    META_GRAPH_API_VERSION: 'v21.0',
    META_GRAPH_TIMEOUT_MS: 3000,
    PUBLIC_RATE_LIMIT_PER_MINUTE: 120,
    DEFAULT_ORGANIZATION_ID: '0198f000-0000-7000-8000-000000000001',
    DB_PATH: join(tmpdir(), `crm-leads-test-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    DEV_API_TOKEN,
    ...overrides,
  } as Env;
}

describe('LeadsController (integración)', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let baseUrl: string;
  let env: Env;

  beforeAll(async () => {
    env = testEnv();
    app = await createApp(env, { shutdownHooks: false });
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  });

  afterAll(async () => {
    await app.close();
    if (env.DB_PATH !== undefined) {
      await rm(env.DB_PATH, { recursive: true, force: true });
    }
  });

  it('GET /leads devuelve la lista sembrada', async () => {
    const response = await fetch(`${baseUrl}/leads`, {
      headers: { 'X-Dev-Api-Token': DEV_API_TOKEN },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: unknown[]; pageInfo: { hasMore: boolean } };
    expect(body.items).toHaveLength(3);
    expect(body.pageInfo.hasMore).toBe(false);
  });

  it('GET /leads filtra por status', async () => {
    const response = await fetch(`${baseUrl}/leads?status=NEW`, {
      headers: { 'X-Dev-Api-Token': DEV_API_TOKEN },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: Array<{ status: string }> };
    expect(body.items.every((lead) => lead.status === 'NEW')).toBe(true);
  });

  it('GET /leads/:id devuelve un lead existente', async () => {
    const response = await fetch(`${baseUrl}/leads/01990000-0000-7000-8000-000000000001`, {
      headers: { 'X-Dev-Api-Token': DEV_API_TOKEN },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string; contactName: string | null };
    expect(body.id).toBe('01990000-0000-7000-8000-000000000001');
    expect(body.contactName).toBe('Ana Gómez');
  });

  it('GET /leads/:id desconocido devuelve 404', async () => {
    const response = await fetch(`${baseUrl}/leads/00000000-0000-7000-8000-000000000000`, {
      headers: { 'X-Dev-Api-Token': DEV_API_TOKEN },
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('POST /leads crea un lead', async () => {
    const response = await fetch(`${baseUrl}/leads`, {
      method: 'POST',
      headers: {
        'X-Dev-Api-Token': DEV_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identity: { email: 'nuevo@ejemplo.com', phone: '+573009998877' },
        status: 'NEW',
        source: 'manual',
        channel: 'MANUAL',
      }),
    });

    expect(response.status).toBe(201);
    const location = response.headers.get('Location');
    expect(location).toMatch(/^\/api\/v1\/leads\//);
    const body = (await response.json()) as { id: string; identity: { email: string } };
    expect(body.identity.email).toBe('nuevo@ejemplo.com');
  });

  it('PATCH /leads/:id actualiza el lead', async () => {
    const response = await fetch(`${baseUrl}/leads/01990000-0000-7000-8000-000000000001`, {
      method: 'PATCH',
      headers: {
        'X-Dev-Api-Token': DEV_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'QUALIFIED', score: 95 }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; score: number };
    expect(body.status).toBe('QUALIFIED');
    expect(body.score).toBe(95);
  });

  it('POST /leads/:id/convert marca el lead como convertido', async () => {
    const response = await fetch(`${baseUrl}/leads/01990000-0000-7000-8000-000000000003/convert`, {
      method: 'POST',
      headers: { 'X-Dev-Api-Token': DEV_API_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; convertedAt: string | null };
    expect(body.status).toBe('CONVERTED');
    expect(body.convertedAt).not.toBeNull();
  });

  it('POST /leads/:id/first-response marca la primera respuesta', async () => {
    const response = await fetch(
      `${baseUrl}/leads/01990000-0000-7000-8000-000000000001/first-response`,
      {
        method: 'POST',
        headers: { 'X-Dev-Api-Token': DEV_API_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ closedVia: 'WHATSAPP' }),
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { firstResponseAt: string | null; closedVia: string | null };
    expect(body.firstResponseAt).not.toBeNull();
    expect(body.closedVia).toBe('WHATSAPP');
  });

  it('rechaza la petición sin token de desarrollo', async () => {
    const response = await fetch(`${baseUrl}/leads`);

    expect(response.status).toBe(401);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('persiste los cambios entre reinicios de la app', async () => {
    // 1. Crear un lead en la instancia actual.
    const createResponse = await fetch(`${baseUrl}/leads`, {
      method: 'POST',
      headers: {
        'X-Dev-Api-Token': DEV_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identity: { email: 'persistente@ejemplo.com', phone: '+573001111111' },
        status: 'NEW',
        source: 'manual',
        channel: 'MANUAL',
      }),
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { id: string };

    // 2. Cerrar la app y levantar una nueva con la misma DB_PATH.
    await app.close();
    app = await createApp(env, { shutdownHooks: false });
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    // 3. El lead debe existir en la nueva instancia.
    const findResponse = await fetch(`${baseUrl}/leads/${created.id}`, {
      headers: { 'X-Dev-Api-Token': DEV_API_TOKEN },
    });
    expect(findResponse.status).toBe(200);
    const found = (await findResponse.json()) as { id: string; identity: { email: string } };
    expect(found.id).toBe(created.id);
    expect(found.identity.email).toBe('persistente@ejemplo.com');
  });
});
