import { Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppError } from './app-error.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';
import { runWithRequestContext } from './request-context.js';
import type { RequestWithContext } from './trace-id.middleware.js';

const TRACE = '7c1f9a4e2b8d3f6a0c5e9b2d4a7f1c3e';

beforeAll(() => {
  // El filtro registra cada error. En los tests eso es ruido, y taparlo enmascara el resultado.
  Logger.overrideLogger(false);
});

interface CapturedResponse {
  statusCode?: number;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

function makeHost(originalUrl = '/api/v1/leads', traceId: string | undefined = TRACE) {
  const captured: CapturedResponse = { headers: {} };

  // `path` va recortado a propósito, imitando lo que hace Express bajo el prefijo global: así el
  // test falla si alguien vuelve a leer `path` en lugar de `originalUrl`.
  const request = {
    originalUrl,
    path: originalUrl.replace('/api/v1', ''),
    traceId,
  } as RequestWithContext;
  const response = {
    headersSent: false,
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, captured };
}

function run(exception: unknown, isProduction = false, originalUrl?: string): CapturedResponse {
  const { host, captured } = makeHost(originalUrl);
  new ProblemDetailsFilter(isProduction).catch(exception, host);
  return captured;
}

/** Un `ZodError` auténtico, tal como lo produce el pipeline en producción. */
function realZodError(): unknown {
  const schema = z.object({ quantity: z.number(), email: z.email() });
  const result = schema.safeParse({ quantity: 'tres', email: 'ana@@ejemplo.com' });
  if (result.success) {
    throw new Error('El schema de prueba debería haber fallado.');
  }
  return result.error;
}

describe('ProblemDetailsFilter', () => {
  it('traduce un AppError usando el catálogo, no lo que diga el throw', () => {
    const captured = run(new AppError('ECONOMICS_GATE_FAILED', 'El margen no cubre el CPA.'));

    expect(captured.statusCode).toBe(422);
    expect(captured.body).toMatchObject({
      code: 'ECONOMICS_GATE_FAILED',
      status: 422,
      retryable: false,
      type: 'https://errors.crm-ventas.internal/problems/economics-gate-failed',
      instance: '/api/v1/leads',
      traceId: TRACE,
    });
  });

  it('publica el problem+json con el Content-Type de RFC 9457', () => {
    const captured = run(new AppError('RESOURCE_NOT_FOUND', 'No existe.'));

    expect(captured.headers['Content-Type']).toBe('application/problem+json; charset=utf-8');
  });

  it('propaga el context del AppError', () => {
    const captured = run(
      new AppError('CAMPAIGN_INVALID_TRANSITION', 'Transición no permitida.', {
        context: { from: 'ARCHIVED', to: 'ACTIVE' },
      }),
    );

    expect(captured.body).toMatchObject({ context: { from: 'ARCHIVED', to: 'ACTIVE' } });
  });

  it('convierte un ZodError real en VALIDATION_FAILED con un issue por campo', () => {
    const captured = run(realZodError());

    expect(captured.statusCode).toBe(422);
    expect(captured.body).toMatchObject({ code: 'VALIDATION_FAILED' });

    const errors = captured.body?.errors as Array<Record<string, unknown>>;
    expect(errors.map((issue) => issue.path)).toEqual(['quantity', 'email']);
  });

  it('NO reenvía NINGÚN valor del cuerpo en un error de validación', () => {
    // Comprobado contra Zod 4: sus issues traen `path`, `code` y `message`, pero NO el valor
    // recibido. Y no lo reconstruimos desde `req.body` a propósito: eso sería reenviar datos del
    // cliente basándose en una heurística por nombre de campo, y un único campo mal nombrado se
    // convierte en una fuga de credenciales (regla de docs/api.md §2.2).
    const captured = run(realZodError());

    const serialized = JSON.stringify(captured.body);
    expect(serialized).not.toContain('ana@@ejemplo.com');
    expect(serialized).not.toContain('tres');

    const errors = captured.body?.errors as Array<Record<string, unknown>>;
    expect(errors.length).toBeGreaterThan(0);
    for (const issue of errors) {
      expect(issue).not.toHaveProperty('received');
    }
  });

  it('mapea el 404 del router de Express a RESOURCE_NOT_FOUND', () => {
    const captured = run(new HttpException('Cannot GET /api/v1/nope', 404));

    expect(captured.statusCode).toBe(404);
    expect(captured.body).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    // El mensaje del framework no se reenvía: se usa el detalle del contrato.
    expect(JSON.stringify(captured.body)).not.toContain('Cannot GET');
  });

  it('NO filtra el mensaje interno de un error no clasificado en producción', () => {
    const leaky = new Error('relation "leads" does not exist at /srv/app/src/leads.service.ts:42');

    const captured = run(leaky, true);

    expect(captured.statusCode).toBe(500);
    expect(captured.body).toMatchObject({ code: 'INTERNAL_ERROR', retryable: true });

    const serialized = JSON.stringify(captured.body);
    expect(serialized).not.toContain('leads.service.ts');
    expect(serialized).not.toContain('relation');
  });

  it('sí muestra el mensaje en desarrollo, para poder depurar', () => {
    const captured = run(new Error('algo se rompió'), false);

    expect(JSON.stringify(captured.body)).toContain('algo se rompió');
  });

  it('responde 500 aunque la excepción traiga otro status sin clasificar', () => {
    // Un 4xx que llega hasta aquí significa que no supimos clasificarlo. Devolver 500 lo hace
    // ruidoso en vez de silenciosamente incorrecto.
    const captured = run(new HttpException('Payload Too Large', 413));

    expect(captured.statusCode).toBe(500);
    expect(captured.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('toma el traceId del contexto asíncrono cuando el request no lo trae', () => {
    const { host, captured } = makeHost('/x', undefined);

    runWithRequestContext({ traceId: TRACE }, () => {
      new ProblemDetailsFilter(false).catch(new Error('x'), host);
    });

    expect(captured.body).toMatchObject({ traceId: TRACE });
  });

  it('genera un traceId con el formato del contrato si nadie lo proveyó', () => {
    const { host, captured } = makeHost('/x', undefined);

    new ProblemDetailsFilter(false).catch(new Error('x'), host);

    expect(captured.body).toMatchObject({ traceId: expect.stringMatching(/^[0-9a-f]{32}$/) });
  });

  it('publica la ruta COMPLETA en instance, con el prefijo global', () => {
    // Verificado contra el servidor real: Nest monta el router bajo /api/v1 y Express recorta ese
    // prefijo de `req.path`, así que un 404 en /api/v1/nope llegaba como "/nope". El contrato
    // escribe la ruta tal como la pidió el cliente.
    const captured = run(new HttpException('Cannot GET /api/v1/nope', 404), false, '/api/v1/nope');

    expect(captured.body).toMatchObject({ instance: '/api/v1/nope' });
  });

  it('no incluye la query string en el instance', () => {
    // Con `originalUrl` a secas, un token en la query acabaría copiado en el cuerpo del error y
    // en los logs.
    const captured = run(
      new AppError('RESOURCE_NOT_FOUND', 'No existe.'),
      false,
      '/api/v1/leads?token=secreto&page=2',
    );

    const serialized = JSON.stringify(captured.body);
    expect(captured.body).toMatchObject({ instance: '/api/v1/leads' });
    expect(serialized).not.toContain('secreto');
  });
});
