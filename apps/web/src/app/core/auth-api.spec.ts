import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ProblemDetails } from '@crm/contracts';

import { AuthApi, esRutaAusente, parseRetryAfter } from './auth-api';

/**
 * Pruebas del cliente de autenticación.
 *
 * No comprueban «hace un POST»: comprueban las cuatro cosas que fallan **en silencio** y que no se
 * pueden detectar mirando la pantalla. Están en la cabecera de cada test porque son el motivo de que
 * exista.
 */
describe('AuthApi', () => {
  let api: AuthApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    api = TestBed.inject(AuthApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  const RESPUESTA_DE_LOGIN = {
    accessToken: 'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJ1MSJ9.firma',
    tokenType: 'Bearer',
    expiresIn: 900,
    user: {
      id: '0198f0aa-1b2c-7d3e-9f40-5a6b7c8d9e01',
      email: 'owner@crm-ventas.local',
      role: 'OWNER',
      status: 'ACTIVE',
      organizationId: '0198f000-0000-7000-8000-000000000001',
      permissions: ['READ_PRODUCTS'],
    },
  };

  it('el login manda el cuerpo del contrato y acepta la cookie de refresco', async () => {
    // Sin `withCredentials` el navegador descarta el `Set-Cookie`: se entra bien y no se puede
    // restaurar la sesión nunca más. Es el fallo que no se ve hasta que alguien recarga.
    const promesa = api.login('owner@crm-ventas.local', 'secreta', false);

    const peticion = http.expectOne('/api/v1/auth/login');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      email: 'owner@crm-ventas.local',
      password: 'secreta',
      rememberDevice: false,
    });
    expect(peticion.request.withCredentials).toBe(true);

    peticion.flush(RESPUESTA_DE_LOGIN);

    await expect(promesa).resolves.toMatchObject({ outcome: 'ok', httpStatus: 200 });
  });

  it('el refresh es un POST sin cuerpo, con la cookie, y sin `Authorization`', async () => {
    // Tres cosas de una vez, y las tres importan:
    //  · POST sin cuerpo → no lo dispara un prefetch ni un <img> (docs/api.md §3.4).
    //  · con cookie → es la ÚNICA credencial que tiene: si no viaja, no hay sesión que restaurar.
    //  · sin `Authorization` → no hay access token todavía; es justo lo que se viene a pedir.
    const promesa = api.refresh();

    const peticion: TestRequest = http.expectOne('/api/v1/auth/refresh');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toBeNull();
    expect(peticion.request.withCredentials).toBe(true);
    expect(peticion.request.headers.has('Authorization')).toBe(false);

    peticion.flush({
      accessToken: 'nuevo',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: 'u1', permissions: ['READ_PRODUCTS'] },
    });

    await expect(promesa).resolves.toMatchObject({ outcome: 'ok' });
  });

  it('el logout va con la cookie, que es lo que revoca la familia', async () => {
    const promesa = api.logout();

    const peticion = http.expectOne('/api/v1/auth/logout');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.withCredentials).toBe(true);

    peticion.flush(null, { status: 204, statusText: 'No Content' });

    await expect(promesa).resolves.toMatchObject({ outcome: 'ok', body: null });
  });

  it('`me` es el único que lleva la cabecera `Authorization`', async () => {
    const promesa = api.me('un-token');

    const peticion = http.expectOne('/api/v1/auth/me');
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer un-token');

    peticion.flush({ id: 'u1', email: 'a@b.c', role: 'OWNER', organization: {}, permissions: [], lastLoginAt: '' });

    await expect(promesa).resolves.toMatchObject({ outcome: 'ok' });
  });

  it('un `accessToken` vacío NO se da por bueno', async () => {
    // Un `""` pasa un `typeof === 'string'`. Aceptarlo dejaría la aplicación «autenticada» sin
    // credencial: no falla al entrar, falla en la primera petición de verdad, lejos de la causa.
    const promesa = api.login('a@b.c', 'x', false);

    http.expectOne('/api/v1/auth/login').flush({ ...RESPUESTA_DE_LOGIN, accessToken: '' });

    const resultado = await promesa;
    expect(resultado.outcome).toBe('unreachable');
    expect(resultado.body).toBeNull();
    expect(resultado.transportError).toContain('contrato de autenticación');
  });

  it('una respuesta de login sin bloque `user` tampoco', async () => {
    const promesa = api.login('a@b.c', 'x', false);

    http.expectOne('/api/v1/auth/login').flush({ accessToken: 'x', tokenType: 'Bearer', expiresIn: 900 });

    await expect(promesa).resolves.toMatchObject({ outcome: 'unreachable' });
  });

  it('traduce el 423 con `Retry-After` a código y espera', async () => {
    const promesa = api.login('a@b.c', 'x', false);

    http.expectOne('/api/v1/auth/login').flush(
      {
        type: 'about:blank',
        title: 'Cuenta bloqueada',
        status: 423,
        code: 'AUTH_ACCOUNT_LOCKED',
        detail: 'Demasiados intentos fallidos.',
        instance: '/api/v1/auth/login',
        traceId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
      },
      { status: 423, statusText: 'Locked', headers: { 'Retry-After': '900' } },
    );

    const resultado = await promesa;
    expect(resultado.outcome).toBe('problem');
    expect(resultado.problem?.code).toBe('AUTH_ACCOUNT_LOCKED');
    expect(resultado.retryAfterSeconds).toBe(900);
  });

  it('un 423 sin `Retry-After` legible no inventa una cifra', async () => {
    // Decir «espera 15 minutos» cuando el servidor no lo ha dicho es exactamente inventar un dato.
    const promesa = api.login('a@b.c', 'x', false);

    http.expectOne('/api/v1/auth/login').flush(
      { type: 'about:blank', title: 'Cuenta bloqueada', status: 423, code: 'AUTH_ACCOUNT_LOCKED' },
      { status: 423, statusText: 'Locked', headers: { 'Retry-After': 'en-un-rato' } },
    );

    const resultado = await promesa;
    expect(resultado.problem?.code).toBe('AUTH_ACCOUNT_LOCKED');
    expect(resultado.retryAfterSeconds).toBeNull();
  });

  it('un 502 con cuerpo HTML es un fallo de transporte, no un problema del contrato', async () => {
    const promesa = api.login('a@b.c', 'x', false);

    http.expectOne('/api/v1/auth/login').flush('<html>Bad gateway</html>', {
      status: 502,
      statusText: 'Bad Gateway',
    });

    const resultado = await promesa;
    expect(resultado.outcome).toBe('unreachable');
    expect(resultado.problem).toBeNull();
    expect(resultado.transportError).toContain('problem+json');
    expect(esRutaAusente(resultado)).toBe(false);
  });

  it('sin respuesta del servidor lo dice, en vez de culpar al contrato', async () => {
    const promesa = api.login('a@b.c', 'x', false);

    http.expectOne('/api/v1/auth/login').error(new ProgressEvent('error'));

    const resultado = await promesa;
    expect(resultado.outcome).toBe('unreachable');
    expect(resultado.httpStatus).toBeNull();
    expect(resultado.transportError).toContain('puerto 3000');
  });
});

/**
 * El caso de HOY. El módulo `auth` no existe, así que Nest responde su 404 por defecto, que no es
 * problem+json. Esta función es lo que separa «el servicio de acceso todavía no está desplegado» de
 * «error 404», que es la diferencia entre un mensaje útil y uno que manda a buscar donde no es.
 */
describe('esRutaAusente', () => {
  function problem(codigo: string): ProblemDetails {
    return { type: 'about:blank', title: 'x', status: 404, code: codigo } as ProblemDetails;
  }

  it('reconoce el 404 por defecto de Nest, que no es problem+json', () => {
    expect(esRutaAusente({ httpStatus: 404, problem: null })).toBe(true);
  });

  it('reconoce también el 404 del contrato, por si el módulo llega antes que el contrato', () => {
    expect(esRutaAusente({ httpStatus: 404, problem: problem('RESOURCE_NOT_FOUND') })).toBe(true);
  });

  it('un 404 con OTRO código de error NO es una ruta ausente', () => {
    expect(esRutaAusente({ httpStatus: 404, problem: problem('LEAD_NOT_FOUND') })).toBe(false);
  });

  it('no confunde un 500 ni un 401 con una ruta ausente', () => {
    expect(esRutaAusente({ httpStatus: 500, problem: null })).toBe(false);
    expect(esRutaAusente({ httpStatus: 401, problem: null })).toBe(false);
    expect(esRutaAusente({ httpStatus: null, problem: null })).toBe(false);
  });
});

/**
 * `Retry-After` admite dos formatos según el RFC y los dos se ven en la práctica. Lo que no se hace
 * nunca es convertir un valor ilegible en un número plausible.
 */
describe('parseRetryAfter', () => {
  it('acepta segundos, que es la forma habitual', () => {
    expect(parseRetryAfter('900')).toBe(900);
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('acepta una fecha HTTP y la convierte a segundos', () => {
    const ahora = new Date('2026-10-01T10:00:00Z');

    expect(parseRetryAfter('Thu, 01 Oct 2026 10:15:00 GMT', ahora)).toBe(900);
  });

  it('una fecha ya pasada significa «reintenta ya», no «no lo sé»', () => {
    const ahora = new Date('2026-10-01T10:00:00Z');

    expect(parseRetryAfter('Thu, 01 Oct 2026 09:59:00 GMT', ahora)).toBe(0);
  });

  it('devuelve `null` ante algo ilegible, en vez de inventar', () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('')).toBeNull();
    expect(parseRetryAfter('   ')).toBeNull();
    expect(parseRetryAfter('en un rato')).toBeNull();
  });

  it('no acepta un valor que no es ni segundos ni una fecha HTTP', () => {
    // Medido en V8: `Date.parse('-5')` y `Date.parse('1.5')` NO son NaN, los lee como años. Sin la
    // comprobación de forma, estos dos valores se convertirían en esperas de miles de años.
    expect(parseRetryAfter('-5')).toBeNull();
    expect(parseRetryAfter('1.5')).toBeNull();
  });

  it('no acepta un entero que desborda el rango seguro', () => {
    expect(parseRetryAfter('99999999999999999999999')).toBeNull();
  });
});
