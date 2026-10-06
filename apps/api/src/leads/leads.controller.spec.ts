import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AddressInfo } from 'node:net';

import { createApp } from '../app.factory.js';
import type { Env } from '../config/env.js';
import {
  createTestPrisma,
  DEFAULT_TEST_DATABASE_URL,
  resetDatabase,
} from '../prisma/test-setup.js';

const OWNER_EMAIL = 'owner@crm-ventas.local';
const OWNER_PASSWORD = 'test-owner-password-12345';
const JWT_SECRET = 'test-secret-for-jwt-must-be-at-least-32-bytes-long';

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
    DATABASE_URL: process.env['TEST_DATABASE_URL'] ?? DEFAULT_TEST_DATABASE_URL,
    JWT_SECRET,
    JWT_ISSUER: 'crm-ventas.api',
    JWT_AUDIENCE: 'crm-ventas.web',
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_DAYS: 30,
    MAX_FAILED_ATTEMPTS: 5,
    OWNER_PASSWORD,
    ...overrides,
  } as Env;
}

async function fetchAccessToken(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

describe('LeadsController (integración)', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let baseUrl: string;
  let env: Env;
  let testPrisma: ReturnType<typeof createTestPrisma>;

  let token: string;

  beforeAll(async () => {
    env = testEnv();
    testPrisma = createTestPrisma(env.DATABASE_URL);
    await resetDatabase(testPrisma);
    app = await createApp(env, { shutdownHooks: false });
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
    token = await fetchAccessToken(baseUrl);
  });

  afterAll(async () => {
    await app?.close();
    await resetDatabase(testPrisma);
    await testPrisma?.$disconnect();
  });

  it('GET /leads devuelve la lista sembrada', async () => {
    const response = await fetch(`${baseUrl}/leads`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: unknown[]; pageInfo: { hasMore: boolean } };
    expect(body.items).toHaveLength(3);
    expect(body.pageInfo.hasMore).toBe(false);
  });

  it('GET /leads filtra por status', async () => {
    const response = await fetch(`${baseUrl}/leads?status=NEW`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: Array<{ status: string }> };
    expect(body.items.every((lead) => lead.status === 'NEW')).toBe(true);
  });

  it('GET /leads/:id devuelve un lead existente', async () => {
    const response = await fetch(`${baseUrl}/leads/01990000-0000-7000-8000-000000000001`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string; contactName: string | null };
    expect(body.id).toBe('01990000-0000-7000-8000-000000000001');
    expect(body.contactName).toBe('Ana Gómez');
  });

  it('GET /leads/:id desconocido devuelve 404', async () => {
    const response = await fetch(`${baseUrl}/leads/00000000-0000-7000-8000-000000000000`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('POST /leads crea un lead', async () => {
    const response = await fetch(`${baseUrl}/leads`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
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
        Authorization: `Bearer ${token}`,
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
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ closedVia: 'WHATSAPP' }),
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { firstResponseAt: string | null; closedVia: string | null };
    expect(body.firstResponseAt).not.toBeNull();
    expect(body.closedVia).toBe('WHATSAPP');
  });

  it('rechaza la petición sin access token', async () => {
    const response = await fetch(`${baseUrl}/leads`);

    expect(response.status).toBe(401);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('persiste los cambios entre reinicios de la app', async () => {
    // 1. Crear un lead en la instancia actual.
    const createResponse = await fetch(`${baseUrl}/leads`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
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

    // 2. Cerrar la app y levantar una nueva conectada a la misma base de datos.
    await app.close();
    app = await createApp(env, { shutdownHooks: false });
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    // 3. El lead debe existir en la nueva instancia.
    const findResponse = await fetch(`${baseUrl}/leads/${created.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(findResponse.status).toBe(200);
    const found = (await findResponse.json()) as { id: string; identity: { email: string } };
    expect(found.id).toBe(created.id);
    expect(found.identity.email).toBe('persistente@ejemplo.com');
  });
});
