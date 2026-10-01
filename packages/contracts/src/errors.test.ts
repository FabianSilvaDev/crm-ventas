import { describe, expect, it } from 'vitest';

import {
  ERROR_CATALOG,
  ERROR_CODES,
  buildProblem,
  isSensitiveField,
  problemDocsFor,
  problemTypeFor,
  problemDetailsSchema,
  toValidationIssues,
} from './errors.js';

const TRACE = '3f9c1d7a6e2b4c8f0a5d9e1b3c7f2a4d';

describe('catálogo de errores', () => {
  it('contiene los 43 códigos de docs/api.md §2.3', () => {
    // Si este número cambia, es que §2.3 cambió o que alguien añadió un código sin documentarlo.
    expect(ERROR_CODES).toHaveLength(43);
  });

  it('no tiene códigos duplicados', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it('todo código tiene status HTTP válido y title no vacío', () => {
    for (const code of ERROR_CODES) {
      const spec = ERROR_CATALOG[code];
      expect(spec.status, code).toBeGreaterThanOrEqual(400);
      expect(spec.status, code).toBeLessThan(600);
      expect(spec.title.trim(), code).not.toBe('');
    }
  });

  it('los status del catálogo son los que documenta §2.3', () => {
    // Muestra representativa, no los 43: si una fila se transcribe mal, esto lo delata.
    expect(ERROR_CATALOG.AUTH_ACCOUNT_LOCKED.status).toBe(423);
    expect(ERROR_CATALOG.APPROVAL_EXPIRED.status).toBe(410);
    expect(ERROR_CATALOG.PRECONDITION_FAILED.status).toBe(412);
    expect(ERROR_CATALOG.TOOL_TIMEOUT.status).toBe(504);
    expect(ERROR_CATALOG.TOOL_BAD_OUTPUT.status).toBe(502);
    expect(ERROR_CATALOG.DEPENDENCY_UNAVAILABLE.status).toBe(503);
    expect(ERROR_CATALOG.INTERNAL_ERROR.status).toBe(500);
  });

  it('marca reintentable solo lo que §2.3 marca reintentable', () => {
    expect(ERROR_CATALOG.AUTH_TOKEN_EXPIRED.retryable).toBe(true);
    expect(ERROR_CATALOG.RATE_LIMIT_EXCEEDED.retryable).toBe(true);
    expect(ERROR_CATALOG.IDEMPOTENCY_IN_PROGRESS.retryable).toBe(true);
    // Estos tres son los que un `retry` ciego haría daño: nunca deben marcarse reintentables.
    expect(ERROR_CATALOG.AUTH_INVALID_CREDENTIALS.retryable).toBe(false);
    expect(ERROR_CATALOG.VALIDATION_FAILED.retryable).toBe(false);
    expect(ERROR_CATALOG.ECONOMICS_GATE_FAILED.retryable).toBe(false);
  });
});

describe('derivación de type y docs', () => {
  it('deriva el kebab-case del código', () => {
    expect(problemTypeFor('VALIDATION_FAILED')).toBe(
      'https://errors.crm-ventas.internal/problems/validation-failed',
    );
    expect(problemDocsFor('CAMPAIGN_INVALID_TRANSITION')).toBe(
      'https://docs.crm-ventas.internal/api/errors/campaign-invalid-transition',
    );
  });

  it('produce un type distinto por código', () => {
    const types = ERROR_CODES.map(problemTypeFor);
    expect(new Set(types).size).toBe(ERROR_CODES.length);
  });
});

describe('buildProblem', () => {
  it('rellena status, retryable, type y docs desde el catálogo', () => {
    const problem = buildProblem({
      code: 'CAMPAIGN_INVALID_TRANSITION',
      detail: 'No se puede pasar de ARCHIVED a ACTIVE.',
      instance: '/api/v1/campaigns/0198f2c1/activate',
      traceId: TRACE,
      timestamp: '2026-10-01T14:22:31.482Z',
      context: { campaignId: '0198f2c1', from: 'ARCHIVED', to: 'ACTIVE' },
    });

    expect(problem.status).toBe(409);
    expect(problem.retryable).toBe(false);
    expect(problem.title).toBe('Transición de campaña no permitida');
    expect(problem.type).toBe(
      'https://errors.crm-ventas.internal/problems/campaign-invalid-transition',
    );
    expect(problem.code).toBe('CAMPAIGN_INVALID_TRANSITION');
    expect(problem.instance).toBe('/api/v1/campaigns/0198f2c1/activate');
    expect(problem.traceId).toBe(TRACE);
    // El timestamp se respeta tal cual: la reproducibilidad de un test no puede depender del reloj.
    expect(problem.timestamp).toBe('2026-10-01T14:22:31.482Z');
  });

  it('produce un problem+json que valida contra su propio schema', () => {
    const problem = buildProblem({
      code: 'RESOURCE_NOT_FOUND',
      detail: 'El lead no existe.',
      instance: '/api/v1/leads/0198f2c1',
      traceId: TRACE,
    });

    expect(() => problemDetailsSchema.parse(problem)).not.toThrow();
    expect(problem.status).toBe(404);
    expect(problem.type).toContain('/resource-not-found');
  });

  it('omite context y errors cuando no se pasan', () => {
    const problem = buildProblem({
      code: 'INTERNAL_ERROR',
      detail: 'Fallo no clasificado.',
      instance: '/api/v1/anything',
      traceId: TRACE,
    });

    expect(problem).not.toHaveProperty('context');
    expect(problem).not.toHaveProperty('errors');
    expect(problem).toHaveProperty('docs');
  });

  it('incluye errors solo si hay al menos uno', () => {
    const vacio = buildProblem({
      code: 'VALIDATION_FAILED',
      detail: 'Sin errores de campo.',
      instance: '/api/v1/leads',
      traceId: TRACE,
      errors: [],
    });
    expect(vacio).not.toHaveProperty('errors');

    const conError = buildProblem({
      code: 'VALIDATION_FAILED',
      detail: '1 campo no supera la validación.',
      instance: '/api/v1/leads',
      traceId: TRACE,
      errors: [{ path: 'name', code: 'invalid_type', message: 'Requerido.' }],
    });
    expect(conError.errors).toHaveLength(1);
  });
});

describe('redacción de PII en errores de validación', () => {
  it('detecta campos sensibles por el último segmento del path', () => {
    expect(isSensitiveField('password')).toBe(true);
    expect(isSensitiveField('identity.email')).toBe(true);
    expect(isSensitiveField('user.refreshToken')).toBe(true);
    expect(isSensitiveField('phone')).toBe(true);
    expect(isSensitiveField('name')).toBe(false);
    expect(isSensitiveField('product.sku')).toBe(false);
  });

  it('NO refleja el valor recibido de un campo sensible', () => {
    const [issue] = toValidationIssues([
      {
        path: ['identity', 'email'],
        code: 'invalid_format',
        message: 'Debe ser un email válido.',
        input: 'ana@@ejemplo.com',
      },
    ]);

    expect(issue?.path).toBe('identity.email');
    expect(issue).not.toHaveProperty('received');
  });

  it('sí refleja el valor de un campo no sensible', () => {
    // Con Zod 4 este camino no se recorre en producción: los issues reales no traen el valor
    // recibido. Se prueba porque `toValidationIssues` acepta issues construidos a mano y esta es
    // la mitad "no redactar" de la regla: si se rompiera, estaríamos redactando de más.
    const [issue] = toValidationIssues([
      {
        path: ['quantity'],
        code: 'invalid_type',
        message: 'Debe ser un número.',
        input: 'tres',
      },
    ]);

    expect(issue?.received).toBe('tres');
  });

  it('lee también el nombre `received` que usaba Zod 3', () => {
    const [issue] = toValidationIssues([
      {
        path: ['quantity'],
        code: 'invalid_type',
        message: 'Debe ser un número.',
        received: 'tres',
      },
    ]);

    expect(issue?.received).toBe('tres');
  });

  it('construye el path con notación de punto', () => {
    const [issue] = toValidationIssues([
      { path: ['items', 0, 'sku'], code: 'invalid_type', message: 'Requerido.' },
    ]);
    expect(issue?.path).toBe('items.0.sku');
  });
});
