import type { AddressInfo } from 'node:net';

import { Controller, Logger, Module, Post, UseGuards } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { ProblemDetailsFilter } from '../../common/problem-details.filter.js';
import { ConfigModule } from '../../config/config.module.js';
import { loadEnv } from '../../config/env.js';
import { META_SIGNATURE_HEADER, computeMetaSignature } from './meta-signature.js';
import { MetaSignatureGuard } from './meta-signature.guard.js';

const SECRET = 'secreto-de-prueba-de-meta-32-caracteres';
const TEST_ENV = loadEnv({ META_APP_SECRET: SECRET, META_VERIFY_TOKEN: 'token-de-verificacion' });

/** Un cuerpo con PII, para poder comprobar que **no** acaba en el log. */
const CUERPO = JSON.stringify({
  object: 'page',
  entry: [
    {
      id: '1234567890',
      changes: [
        {
          field: 'leadgen',
          value: { leadgen_id: 'abc123', form_id: '999' },
        },
      ],
    },
  ],
  email_de_prueba: 'ana@ejemplo.com',
});

@Controller('hook')
class GuardedController {
  @Post()
  @UseGuards(MetaSignatureGuard)
  recibir(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  imports: [ConfigModule.forRoot(TEST_ENV)],
  controllers: [GuardedController],
})
class GuardedModule {}

let app: INestApplication;
let base: string;
let warnSpy: MockInstance;

interface Respuesta {
  readonly status: number;
  readonly contentType: string;
  readonly texto: string;
  readonly body: Record<string, unknown> | undefined;
}

async function publicar(firma: string | undefined, cuerpo = CUERPO): Promise<Respuesta> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (firma !== undefined) {
    headers[META_SIGNATURE_HEADER] = firma;
  }

  const res = await fetch(`${base}/hook`, { method: 'POST', headers, body: cuerpo });
  const texto = await res.text();

  return {
    status: res.status,
    contentType: res.headers.get('content-type') ?? '',
    texto,
    body: texto === '' ? undefined : (JSON.parse(texto) as Record<string, unknown>),
  };
}

beforeAll(async () => {
  // Espía en vez de `Logger.overrideLogger(false)`: silencia igual, pero además deja capturar qué
  // se registró. Es lo que permite comprobar que el cuerpo **no** se registra.
  warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

  app = await NestFactory.create(GuardedModule, {
    logger: false,
    // Imprescindible: sin esto `req.rawBody` no existe y la verificación no tendría de dónde leer
    // los bytes que llegaron.
    rawBody: true,
  });
  app.useGlobalFilters(new ProblemDetailsFilter(true));

  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.close();
  warnSpy.mockRestore();
});

describe('MetaSignatureGuard', () => {
  it('deja pasar un cuerpo firmado con el App Secret', async () => {
    const res = await publicar(computeMetaSignature(Buffer.from(CUERPO, 'utf8'), SECRET));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('rechaza con 401 WEBHOOK_SIGNATURE_INVALID cuando la firma no cuadra', async () => {
    const res = await publicar(`sha256=${'f'.repeat(64)}`);

    expect(res.status).toBe(401);
    expect(res.contentType).toBe('application/problem+json; charset=utf-8');
    expect(res.body).toMatchObject({ code: 'WEBHOOK_SIGNATURE_INVALID', status: 401 });
  });

  it('rechaza la firma de OTRO cuerpo, que es el ataque evidente', async () => {
    // Firmar un cuerpo inocuo y enviar otro: si el guard verificara sobre el objeto parseado o
    // reconstruido, esto pasaría. Es la prueba de que se firman los bytes.
    const firmaDeOtroCuerpo = computeMetaSignature(Buffer.from('{"object":"page"}', 'utf8'), SECRET);

    expect((await publicar(firmaDeOtroCuerpo)).status).toBe(401);
  });

  it('rechaza un cuerpo sin cabecera de firma', async () => {
    expect((await publicar(undefined)).status).toBe(401);
  });

  it('audita el rechazo SIN el cuerpo ni la cabecera', async () => {
    warnSpy.mockClear();

    const res = await publicar(`sha256=${'a'.repeat(64)}`);

    expect(res.status).toBe(401);

    // El filtro global también registra el 401, así que hay más de una línea de log: se busca la
    // del guard por su acción en vez de contar llamadas, que sería frágil.
    const llamadas = warnSpy.mock.calls.map((call) => JSON.stringify(call));
    const auditoria = llamadas.filter((linea) => linea.includes('webhook.signature_invalid'));

    expect(auditoria).toHaveLength(1);

    const [linea] = auditoria;
    // Ni el cuerpo (PII de quien no ha acreditado ser quien dice), ni la firma recibida.
    expect(linea).not.toContain('ana@ejemplo.com');
    expect(linea).not.toContain('abc123');
    expect(linea).not.toContain('a'.repeat(64));
    // Lo que sí debe estar: la marca de qué piezas faltaban o estaban.
    expect(linea).toContain('hasSignatureHeader');
    expect(linea).toContain('hasRawBody');

    // Y ninguna otra línea de log de la petición, incluido el 401 del filtro, filtra el cuerpo.
    expect(llamadas.join('\n')).not.toContain('ana@ejemplo.com');
  });
});
