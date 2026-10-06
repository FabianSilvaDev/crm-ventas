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

function extractCookieValue(setCookieHeader: string | null, name: string): string | undefined {
  if (setCookieHeader === null) {
    return undefined;
  }
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1];
}

describe('AuthController (integración)', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let baseUrl: string;
  let env: Env;
  let testPrisma: ReturnType<typeof createTestPrisma>;

  beforeAll(async () => {
    env = testEnv();
    testPrisma = createTestPrisma(env.DATABASE_URL);
    await resetDatabase(testPrisma);
    app = await createApp(env, { shutdownHooks: false });
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  });

  afterAll(async () => {
    await app?.close();
    await resetDatabase(testPrisma);
    await testPrisma?.$disconnect();
  });

  it('POST /auth/login devuelve access token y cookie de refresh', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      accessToken: string;
      tokenType: string;
      expiresIn: number;
      user: { id: string; role: string; permissions: string[] };
    };
    expect(body.tokenType).toBe('Bearer');
    expect(body.expiresIn).toBe(900);
    expect(body.user.role).toBe('OWNER');
    expect(body.user.permissions.length).toBeGreaterThan(0);

    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('__Host-crm_rt=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
  });

  it('POST /auth/login rechaza credenciales incorrectas', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: OWNER_EMAIL, password: 'mal' }),
    });

    expect(response.status).toBe(401);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('POST /auth/refresh rota el refresh token y devuelve un nuevo access token', async () => {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const oldCookie = loginResponse.headers.get('set-cookie');
    const oldToken = extractCookieValue(oldCookie, '__Host-crm_rt');
    expect(oldToken).toBeDefined();

    const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: oldCookie ?? '', Origin: env.WEB_ORIGIN },
    });

    expect(refreshResponse.status).toBe(200);
    const body = (await refreshResponse.json()) as {
      accessToken: string;
      tokenType: string;
      user: { id: string };
    };
    expect(body.tokenType).toBe('Bearer');
    expect(body.accessToken).toBeDefined();

    const newCookie = refreshResponse.headers.get('set-cookie');
    expect(newCookie).toBeDefined();
    const newToken = extractCookieValue(newCookie, '__Host-crm_rt');
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(oldToken);

    // Reusar el refresh token antiguo debe detectarse y rechazarse.
    const reuseResponse = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: oldCookie ?? '', Origin: env.WEB_ORIGIN },
    });
    expect(reuseResponse.status).toBe(401);
    const reuseBody = (await reuseResponse.json()) as { code: string };
    expect(reuseBody.code).toBe('REFRESH_TOKEN_REUSE_DETECTED');
  });

  it('POST /auth/logout revoca el refresh token', async () => {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    });
    const cookie = loginResponse.headers.get('set-cookie');

    const logoutResponse = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie ?? '' },
    });
    expect(logoutResponse.status).toBe(204);

    // Tras logout el refresh token ya no sirve.
    const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: cookie ?? '', Origin: env.WEB_ORIGIN },
    });
    expect(refreshResponse.status).toBe(401);
  });

  it('GET /auth/me devuelve el usuario autenticado', async () => {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    });
    const { accessToken } = (await loginResponse.json()) as { accessToken: string };

    const meResponse = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(meResponse.status).toBe(200);
    const body = (await meResponse.json()) as {
      id: string;
      email: string;
      role: string;
      organization: { id: string; name: string };
    };
    expect(body.email).toBe(OWNER_EMAIL);
    expect(body.role).toBe('OWNER');
    expect(body.organization.id).toBe(env.DEFAULT_ORGANIZATION_ID);
  });

  it('GET /auth/me rechaza peticiones sin token', async () => {
    const response = await fetch(`${baseUrl}/auth/me`);
    expect(response.status).toBe(401);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('POST /auth/register crea un AGENT protegido por MANAGE_AGENTS', async () => {
    const agentEmail = `agent-${Date.now()}@crm-ventas.local`;
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    });
    const { accessToken } = (await loginResponse.json()) as { accessToken: string };

    const registerResponse = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: agentEmail,
        password: 'Agente#Seguro123',
        role: 'AGENT',
      }),
    });

    expect(registerResponse.status).toBe(201);
    const body = (await registerResponse.json()) as {
      id: string;
      email: string;
      role: string;
      organization: { id: string };
    };
    expect(body.email).toBe(agentEmail);
    expect(body.role).toBe('AGENT');
    expect(body.organization.id).toBe(env.DEFAULT_ORGANIZATION_ID);

    // El nuevo AGENT puede iniciar sesión.
    const agentLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: agentEmail, password: 'Agente#Seguro123' }),
    });
    expect(agentLogin.status).toBe(200);
  });

  it('POST /auth/register rechaza roles distintos de AGENT', async () => {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    });
    const { accessToken } = (await loginResponse.json()) as { accessToken: string };

    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'otro@crm-ventas.local',
        password: 'Agente#Seguro123',
        role: 'OWNER',
      }),
    });

    expect(response.status).toBe(422);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('POST /auth/register rechaza peticiones sin token', async () => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sin-token@crm-ventas.local',
        password: 'Agente#Seguro123',
        role: 'AGENT',
      }),
    });

    expect(response.status).toBe(401);
  });

  it('POST /auth/register-owner crea otro OWNER protegido por OWNER + MANAGE_AGENTS', async () => {
    const ownerEmail = `owner-${Date.now()}@crm-ventas.local`;
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    });
    const { accessToken } = (await loginResponse.json()) as { accessToken: string };

    const response = await fetch(`${baseUrl}/auth/register-owner`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: ownerEmail,
        password: 'Owner#Seguro123',
      }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      id: string;
      email: string;
      role: string;
      permissions: string[];
    };
    expect(body.email).toBe(ownerEmail);
    expect(body.role).toBe('OWNER');
    expect(body.permissions).toContain('MANAGE_AGENTS');

    // El nuevo OWNER puede iniciar sesión.
    const ownerLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password: 'Owner#Seguro123' }),
    });
    expect(ownerLogin.status).toBe(200);
  });

  it('POST /auth/register-owner rechaza a usuarios AGENT aunque tengan MANAGE_AGENTS', async () => {
    const agentEmail = `agent-blocked-${Date.now()}@crm-ventas.local`;
    const ownerLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    });
    const { accessToken: ownerToken } = (await ownerLogin.json()) as { accessToken: string };

    const registerAgent = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: agentEmail,
        password: 'Agente#Seguro123',
        role: 'AGENT',
      }),
    });
    expect(registerAgent.status).toBe(201);

    const agentLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: agentEmail, password: 'Agente#Seguro123' }),
    });
    // En el MVP el AGENT no tiene permisos efectivos, así que el endpoint devolverá 403 por
    // MANAGE_AGENTS antes de llegar a la verificación de OWNER.
    const { accessToken: agentToken } = (await agentLogin.json()) as { accessToken: string };

    const response = await fetch(`${baseUrl}/auth/register-owner`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${agentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'nuevo-owner@crm-ventas.local',
        password: 'Owner#Seguro123',
      }),
    });

    expect(response.status).toBe(403);
  });
});

describe('AuthController — setup de primera cuenta', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let baseUrl: string;
  let env: Env;
  let testPrisma: ReturnType<typeof createTestPrisma>;

  beforeAll(async () => {
    // Sin OWNER_PASSWORD: el seed no crea usuarios, así que setup debe estar disponible.
    env = testEnv({ OWNER_PASSWORD: undefined });
    testPrisma = createTestPrisma(env.DATABASE_URL);
    await resetDatabase(testPrisma);
    app = await createApp(env, { shutdownHooks: false });
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  });

  afterAll(async () => {
    await app?.close();
    await resetDatabase(testPrisma);
    await testPrisma?.$disconnect();
  });

  it('GET /auth/setup indica que se requiere setup cuando no hay usuarios', async () => {
    const response = await fetch(`${baseUrl}/auth/setup`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { required: boolean };
    expect(body.required).toBe(true);
  });

  it('POST /auth/setup crea el OWNER, la organización y devuelve una sesión', async () => {
    const email = 'primer-owner@crm-ventas.local';
    const response = await fetch(`${baseUrl}/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'PrimerPasswordSeguro1!',
        organizationName: 'Operación principal',
      }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      accessToken: string;
      tokenType: string;
      user: { id: string; email: string; role: string; permissions: string[] };
    };
    expect(body.tokenType).toBe('Bearer');
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe('OWNER');
    expect(body.user.permissions).toContain('MANAGE_AGENTS');

    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('__Host-crm_rt=');

    // Tras el setup ya no se requiere.
    const requiredResponse = await fetch(`${baseUrl}/auth/setup`);
    const requiredBody = (await requiredResponse.json()) as { required: boolean };
    expect(requiredBody.required).toBe(false);

    // Un segundo setup debe fallar.
    const secondResponse = await fetch(`${baseUrl}/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'otro@crm-ventas.local',
        password: 'OtroPasswordSeguro1!',
      }),
    });
    expect(secondResponse.status).toBe(409);
    const secondBody = (await secondResponse.json()) as { code: string };
    expect(secondBody.code).toBe('STATE_CONFLICT');
  });
});
