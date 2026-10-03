import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import type { AddressInfo } from 'node:net';

import { Logger } from '@nestjs/common';
import { ERROR_CATALOG } from '@crm/contracts';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { AppError } from '../../common/app-error.js';
import { HttpMetaGraphClient } from './http-meta-graph.client.js';

/**
 * Pruebas del cliente real contra un **servidor HTTP de verdad**, no contra un `fetch` imitado.
 *
 * Importa porque aquí lo que se prueba es precisamente el comportamiento de red: qué cabeceras salen,
 * qué pasa cuando el servidor no contesta, qué pasa cuando contesta algo que no entendemos. Imitar
 * `fetch` probaría que nuestro doble hace lo que le dijimos, que no es la pregunta.
 */
const TOKEN = 'token-de-meta-para-las-pruebas-del-cliente-graph';

let servidor: Server;
let base: string;
let sockets: Set<Socket>;
let responder: (req: IncomingMessage, res: ServerResponse) => void;
let peticiones: { url: string; authorization: string | undefined }[];
let errorSpy: MockInstance;

beforeAll(async () => {
  sockets = new Set();

  servidor = createServer((req, res) => {
    peticiones.push({ url: req.url ?? '', authorization: req.headers.authorization });
    responder(req, res);
  });

  servidor.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  await new Promise<void>((listo) => {
    servidor.listen(0, '127.0.0.1', listo);
  });

  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((listo) => {
    servidor.close(() => listo());
  });
});

beforeEach(() => {
  peticiones = [];
  // Por defecto nadie contesta: cada prueba decide. Así una prueba que se olvide de preparar la
  // respuesta falla por timeout (con su error controlado) en vez de por una respuesta heredada.
  responder = () => undefined;
  errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  // Una petición abandonada por timeout deja el socket abierto: sin cerrarlo, `servidor.close()` de
  // `afterAll` esperaría para siempre.
  for (const socket of sockets) {
    socket.destroy();
  }
  sockets.clear();

  vi.restoreAllMocks();
});

function cliente(opciones: { timeoutMs?: number } = {}): HttpMetaGraphClient {
  return new HttpMetaGraphClient({
    accessToken: TOKEN,
    apiVersion: 'v21.0',
    timeoutMs: opciones.timeoutMs ?? 1000,
    baseUrl: base,
  });
}

function responderJson(status: number, cuerpo: unknown): void {
  responder = (_req, res) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cuerpo));
  };
}

const LEAD = {
  id: 'lead-1',
  form_id: '999',
  field_data: [{ name: 'full_name', values: ['Ana Pérez'] }],
};

describe('HttpMetaGraphClient — camino correcto', () => {
  it('devuelve el lead cuando Meta responde 200', async () => {
    responderJson(200, LEAD);

    const lead = await cliente().fetchLead('lead-1');

    expect(lead?.id).toBe('lead-1');
    expect(lead?.field_data?.[0]?.values).toEqual(['Ana Pérez']);
  });

  it('manda el token en la cabecera `Authorization` y NO en la URL', async () => {
    // La prueba central de la decisión: lo que va en la URL acaba en mensajes de error, pilas y logs
    // de proxies. Si alguien «simplifica» esto pasando `?access_token=`, esta prueba lo caza.
    responderJson(200, LEAD);

    await cliente().fetchLead('lead-1');

    expect(peticiones).toHaveLength(1);
    expect(peticiones[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(peticiones[0]?.url).not.toContain(TOKEN);
    expect(peticiones[0]?.url).not.toContain('access_token');
  });

  it('pide la versión fijada, el id codificado y los campos que la ingesta necesita', async () => {
    responderJson(200, LEAD);

    await cliente().fetchLead('lead-1');

    const url = peticiones[0]?.url ?? '';
    expect(url.startsWith('/v21.0/lead-1?')).toBe(true);
    // Sin `custom_disclaimer_responses` no habría ninguna evidencia de consentimiento que leer.
    expect(url).toContain('custom_disclaimer_responses');
    expect(url).toContain('field_data');
    expect(url).toContain('campaign_id');
  });

  it('codifica un id con caracteres raros en vez de construir una URL rota', async () => {
    responderJson(200, LEAD);

    await cliente().fetchLead('lead/../raro?x=1');

    expect(peticiones[0]?.url).toContain('lead%2F..%2Fraro%3Fx%3D1');
  });
});

describe('HttpMetaGraphClient — «no existe» es un dato, no un fallo', () => {
  it('devuelve `null` cuando Meta responde 404', async () => {
    responderJson(404, { error: { message: 'Unsupported get request.', code: 100 } });

    await expect(cliente().fetchLead('lead-borrado')).resolves.toBeNull();
  });
});

describe('HttpMetaGraphClient — lo que sí es un fallo', () => {
  it('traduce un error de Meta a DEPENDENCY_UNAVAILABLE con el código de diagnóstico', async () => {
    responderJson(400, {
      error: { message: 'Invalid OAuth access token.', type: 'OAuthException', code: 190, fbtrace_id: 'AbC123' },
    });

    const error = await cliente().fetchLead('lead-1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('DEPENDENCY_UNAVAILABLE');
    // 503 y reintentable: la respuesta que el webhook debe darle a Meta para que lo intente más tarde.
    expect(ERROR_CATALOG.DEPENDENCY_UNAVAILABLE).toMatchObject({ status: 503, retryable: true });
    expect((error as AppError).context).toMatchObject({ status: 400, graphCode: 190, fbtraceId: 'AbC123' });
  });

  it('no filtra el token ni el mensaje de Meta al `context`, que sí viaja al cliente', async () => {
    // Meta devuelve el token dentro del mensaje de error (esto pasa de verdad con un token inválido).
    responderJson(401, { error: { message: `Bad token ${TOKEN}`, code: 190 } });

    const error = (await cliente()
      .fetchLead('lead-1')
      .catch((e: unknown) => e)) as AppError;

    const serializado = JSON.stringify({ detail: error.message, context: error.context });
    expect(serializado).not.toContain(TOKEN);
    // El `message` de Meta es texto libre de un tercero: se registra, no se propaga.
    expect(serializado).not.toContain('Bad token');
  });

  it('no filtra el token en ninguna línea de log', async () => {
    // Meta devuelve el token dentro del `message` cuando el problema es el token. Registrarlo tal
    // cual sería escribir el secreto en el log.
    responderJson(500, { error: { message: `fallo con ${TOKEN}`, code: 1 } });

    await cliente().fetchLead('lead-1').catch(() => undefined);

    expect(errorSpy).toHaveBeenCalled();
    for (const llamada of errorSpy.mock.calls) {
      expect(JSON.stringify(llamada)).not.toContain(TOKEN);
    }
  });

  it('conserva el resto del mensaje de Meta, redactado: el diagnóstico no se pierde', async () => {
    responderJson(400, { error: { message: `Invalid OAuth access token ${TOKEN}`, code: 190 } });

    await cliente().fetchLead('lead-1').catch(() => undefined);

    const registrado = JSON.stringify(errorSpy.mock.calls);
    expect(registrado).toContain('Invalid OAuth access token');
    expect(registrado).toContain('[token redactado]');
  });

  it('acota el mensaje de Meta: el texto lo escribe un tercero', async () => {
    responderJson(500, { error: { message: 'x'.repeat(50_000), code: 1 } });

    await cliente().fetchLead('lead-1').catch(() => undefined);

    const registrado = JSON.stringify(errorSpy.mock.calls);
    expect(registrado.length).toBeLessThan(2000);
  });

  it('trata un cuerpo que no es JSON (un proxy devolviendo HTML) sin romperse', async () => {
    responder = (_req, res) => {
      res.writeHead(502, { 'Content-Type': 'text/html' });
      res.end('<html><body>Bad gateway</body></html>');
    };

    const error = (await cliente()
      .fetchLead('lead-1')
      .catch((e: unknown) => e)) as AppError;

    expect(error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(error.context).toMatchObject({ status: 502 });
  });

  it('trata un 200 con una forma desconocida como fallo de la dependencia', async () => {
    responderJson(200, { algo: 'que no entendemos' });

    const error = (await cliente()
      .fetchLead('lead-1')
      .catch((e: unknown) => e)) as AppError;

    expect(error.code).toBe('DEPENDENCY_UNAVAILABLE');
    // El detalle dice qué campo faltó: sin él, «forma inesperada» no ayuda a nadie.
    expect((error.context as { campos: string }).campos).toContain('id');
  });

  it('trata un 200 sin `id` como fallo, no como un lead vacío', async () => {
    // `id` es lo único obligatorio del schema. Un lead sin id no se puede deduplicar.
    responderJson(200, { form_id: '999' });

    await expect(cliente().fetchLead('lead-1')).rejects.toBeInstanceOf(AppError);
  });
});

describe('HttpMetaGraphClient — el tiempo de espera', () => {
  it('respeta el timeout y no espera a un servidor que no contesta', async () => {
    // `responder` no hace nada: el servidor acepta y calla. Es el caso de la Graph API colgada.
    const inicio = Date.now();

    const error = (await cliente({ timeoutMs: 150 })
      .fetchLead('lead-1')
      .catch((e: unknown) => e)) as AppError;

    expect(error.code).toBe('DEPENDENCY_UNAVAILABLE');
    // La distinción exacta entre timeout y otro error de red depende de `AbortSignal.timeout` y del
    // entorno; lo importante es que se respetó el tiempo y se devolvió un error controlado.
    expect(error.context).toMatchObject({ timeoutMs: 150 });
    // Margen amplio a propósito: lo que se afirma es «no esperó indefinidamente», no una cifra exacta,
    // que dependería de la máquina.
    expect(Date.now() - inicio).toBeLessThan(2000);
  });

  it('con un host inalcanzable falla de forma controlada', async () => {
    const inalcanzable = new HttpMetaGraphClient({
      accessToken: TOKEN,
      apiVersion: 'v21.0',
      timeoutMs: 500,
      // Puerto 1 en loopback: no hay nada escuchando.
      baseUrl: 'http://127.0.0.1:1',
    });

    const error = (await inalcanzable.fetchLead('lead-1').catch((e: unknown) => e)) as AppError;

    expect(error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(error.message).toContain('No se pudo contactar');
    expect(JSON.stringify({ detail: error.message, context: error.context })).not.toContain(TOKEN);
  });
});
