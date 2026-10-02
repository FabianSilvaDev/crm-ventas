import { describe, expect, it } from 'vitest';

import { DevAuthGuard } from './dev-auth.guard.js';

function createMockContext(headers: Record<string, string | string[]> = {}) {
  const request = { headers, user: undefined } as unknown as Record<string, unknown>;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as import('@nestjs/common').ExecutionContext;
}

function baseEnv(overrides: Partial<import('./../config/env.js').Env> = {}) {
  return {
    NODE_ENV: 'development',
    PORT: 3000,
    LOG_LEVEL: 'info',
    WEB_ORIGIN: 'http://localhost:4200',
    META_APP_SECRET: 'dev-secret-1234567890123456',
    META_VERIFY_TOKEN: 'dev-verify-1234567890123456',
    META_GRAPH_MODE: 'fixture',
    META_GRAPH_API_VERSION: 'v21.0',
    META_GRAPH_TIMEOUT_MS: 3000,
    PUBLIC_RATE_LIMIT_PER_MINUTE: 120,
    DEFAULT_ORGANIZATION_ID: '0198f000-0000-7000-8000-000000000001',
    ...overrides,
  } as import('./../config/env.js').Env;
}

describe('DevAuthGuard', () => {
  it('permite la petición e inyecta un usuario OWNER con todos los permisos', () => {
    const guard = new DevAuthGuard(baseEnv({ DEV_API_TOKEN: 'dev-token-valido-12345' }));
    const ctx = createMockContext({ 'x-dev-api-token': 'dev-token-valido-12345' });

    expect(guard.canActivate(ctx)).toBe(true);

    const request = ctx.switchToHttp().getRequest() as { user: Record<string, unknown> };
    expect(request.user.role).toBe('OWNER');
    expect(request.user.organizationId).toBe('0198f000-0000-7000-8000-000000000001');
    expect(request.user.permissions).toHaveLength(25);
  });

  it('rechaza cuando el token no coincide', () => {
    const guard = new DevAuthGuard(baseEnv({ DEV_API_TOKEN: 'dev-token-valido-12345' }));
    const ctx = createMockContext({ 'x-dev-api-token': 'otro-token' });

    expect(() => guard.canActivate(ctx)).toThrowError(/Token de desarrollo inválido/);
  });

  it('rechaza cuando falta la cabecera', () => {
    const guard = new DevAuthGuard(baseEnv({ DEV_API_TOKEN: 'dev-token-valido-12345' }));

    expect(() => guard.canActivate(createMockContext())).toThrowError(
      /No hay token de desarrollo configurado|Token de desarrollo inválido/,
    );
  });

  it('rechaza cuando no hay token configurado (fail-closed)', () => {
    const guard = new DevAuthGuard(baseEnv());

    expect(() => guard.canActivate(createMockContext())).toThrowError(
      /No hay token de desarrollo configurado/,
    );
  });

  it('rechaza en producción aunque haya token', () => {
    const guard = new DevAuthGuard(
      baseEnv({ NODE_ENV: 'production', DEV_API_TOKEN: 'dev-token-valido-12345' }),
    );

    expect(() => guard.canActivate(createMockContext())).toThrowError(
      /no está disponible en producción/,
    );
  });
});
