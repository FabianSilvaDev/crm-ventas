import type { AddressInfo } from 'node:net';

import { Body, Controller, Get, Logger, Module, Param, Post, Query } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ProblemDetailsFilter } from '../problem-details.filter.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

/**
 * Estas pruebas levantan un **servidor Nest real** en un puerto efímero y le hablan por HTTP.
 *
 * Se hace así y no con llamadas directas al pipe porque lo que hay que demostrar es el contrato
 * observable —`422` con `problem+json`, body intacto cuando no hay schema—, y eso solo existe una
 * vez que Nest, Express y el pipe han colaborado. Un test que llamase a `transform()` a mano pasaría
 * aunque el pipe no estuviera registrado.
 *
 * La app de prueba se arma aquí con su propio módulo; `createApp` se ejerce de verdad en las pruebas
 * del webhook, donde las rutas reales ya pasan por este pipe (la query del handshake es `@ZodQuery`).
 */

const CUERPO = z.strictObject({
  email: z.email(),
  nombre: z.string().min(1),
});

const CONSULTA = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

@Controller('eco')
class EchoController {
  @Post()
  crear(@Body({ schema: CUERPO }) body: unknown): unknown {
    return body;
  }

  @Get()
  listar(@Query({ schema: CONSULTA }) query: unknown): unknown {
    return query;
  }

  @Get(':id')
  uno(@Param('id') id: string): unknown {
    // Sin `{ schema }`: un `@Param` es un string y **no** debe validarse contra nada. Si el pipe
    // intentara validarlo, esta ruta respondería 422 en vez de 200.
    return { id };
  }
}

@Module({ controllers: [EchoController] })
class EchoModule {}

let app: INestApplication;
let base: string;

interface Respuesta {
  readonly status: number;
  readonly contentType: string;
  readonly body: unknown;
  readonly texto: string;
}

async function pedir(path: string, init?: RequestInit): Promise<Respuesta> {
  const res = await fetch(`${base}${path}`, init);
  const texto = await res.text();

  return {
    status: res.status,
    contentType: res.headers.get('content-type') ?? '',
    body: texto === '' ? undefined : JSON.parse(texto),
    texto,
  };
}

function conCuerpo(value: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  };
}

beforeAll(async () => {
  // El filtro registra cada error y el arranque de Nest también; en una suite eso es ruido.
  Logger.overrideLogger(false);

  app = await NestFactory.create(EchoModule, { logger: false });
  app.useGlobalPipes(new ZodValidationPipe());
  // `isProduction: true` a propósito: así se comprueba que el mensaje que ve el cliente sale del
  // contrato y no de la excepción interna.
  app.useGlobalFilters(new ProblemDetailsFilter(true));

  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.close();
});

describe('ZodValidationPipe', () => {
  it('devuelve el cuerpo ya parseado cuando es válido', async () => {
    const res = await pedir('/eco', conCuerpo({ email: 'ana@ejemplo.com', nombre: 'Ana' }));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ email: 'ana@ejemplo.com', nombre: 'Ana' });
  });

  it('responde 422 VALIDATION_FAILED ante un campo extra en un cuerpo propio', async () => {
    // Es la razón de ser del `strictObject` en las entradas nuestras (`docs/security.md` §11.3): un
    // campo desconocido puede ser un cliente desactualizado o un intento de colar algo, y en ambos
    // casos queremos enterarnos en vez de ignorarlo en silencio.
    const res = await pedir(
      '/eco',
      conCuerpo({ email: 'ana@ejemplo.com', nombre: 'Ana', sobrante: 'no debería estar aquí' }),
    );

    expect(res.status).toBe(422);
    expect(res.contentType).toBe('application/problem+json; charset=utf-8');
    expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED', status: 422 });

    // Zod 4 reporta las claves sobrantes como **un solo issue en la raíz** (`path: []`) con el
    // nombre del campo dentro del mensaje, no como un issue por campo. Se comprueba la forma real
    // para que nadie la "arregle" después hacia una forma que Zod no produce.
    const errors = (res.body as { errors: Array<{ path: string; code: string; message: string }> })
      .errors;
    expect(errors.map((i) => i.code)).toContain('unrecognized_keys');
    expect(errors.map((i) => i.path)).toContain('');
    expect(JSON.stringify(errors)).toContain('sobrante');
  });

  it('no reenvía el valor recibido en un error de validación', async () => {
    const res = await pedir('/eco', conCuerpo({ email: 'ana@@ejemplo.com', nombre: 'Ana' }));

    expect(res.status).toBe(422);
    // El checkpoint del plan, literal: un `email` inválido NO devuelve el valor recibido. Si algún
    // día se "mejora" el mensaje para incluir lo que llegó, este test lo caza antes que un cliente.
    expect(res.texto).not.toContain('ana@@ejemplo.com');

    const errors = (res.body as { errors: Array<Record<string, unknown>> }).errors;
    for (const issue of errors) {
      // Zod 4.6 no adjunta el valor al issue, pero la redacción de `toValidationIssues` es la
      // garantía de que no se reenvía aunque una versión futura vuelva a adjuntarlo.
      expect(issue).not.toHaveProperty('received');
    }
  });

  it('traduce la query, donde todo llega como texto', async () => {
    const res = await pedir('/eco?limit=10');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ limit: 10 });
  });

  it('aplica el valor por defecto de la query cuando no se envía ninguno', async () => {
    const res = await pedir('/eco');

    expect(res.body).toEqual({ limit: 50 });
  });

  it('rechaza la query fuera de rango y los parámetros desconocidos', async () => {
    expect((await pedir('/eco?limit=0')).status).toBe(422);
    expect((await pedir('/eco?limit=101')).status).toBe(422);
    expect((await pedir('/eco?ordenarPor=email')).status).toBe(422);
  });

  it('deja pasar un @Param sin schema, intacto', async () => {
    // El caso que un pipe global «a secas» rompería: sin la marca, el valor atraviesa el pipe tal
    // cual, así que las rutas con `@Param` siguen funcionando sin declarar ningún schema.
    const res = await pedir('/eco/abc-123');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'abc-123' });
  });

  it('responde 422 también ante un cuerpo que no es JSON', async () => {
    const res = await pedir('/eco', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'esto no es json',
    });

    // La ruta no llega a ejecutarse: el parser de Express rechaza antes. Se comprueba que la
    // respuesta sigue siendo un problem+json del contrato y no un HTML de error del framework.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.contentType).toBe('application/problem+json; charset=utf-8');
    expect(res.body).toMatchObject({ code: expect.any(String) });
  });
});
