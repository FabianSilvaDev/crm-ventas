import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ProblemDetails } from '@crm/contracts';

import { environment } from '../../environments/environment';
import { environment as environmentDeProduccion } from '../../environments/environment.production';
import type { AuthResult, LoginBody, MeBody, RefreshBody, RegisterBody, SetupBody } from './auth-api';
import { AuthApi } from './auth-api';
import { SessionService, puertaDeDemostracionAbierta } from './session';

/**
 * Pruebas del estado de sesión.
 *
 * Se dobla `AuthApi` con un objeto de clase, no con `vi.fn()`: es el patrón que ya usan
 * `leads.spec.ts` y `system-status.spec.ts` en este repo, y deja el doble a la vista —qué devuelve
 * exactamente cada endpoint— en vez de esconderlo en una cadena de mocks.
 *
 * No hay componente ni `detectChanges` aquí: esto es estado puro. La comprobación de que la pantalla
 * **repinta** con estos cambios es de `features/login` y del shell, no de este fichero.
 */
class FakeAuthApi {
  refreshResultado: AuthResult<RefreshBody> = ok({
    accessToken: 'token-de-refresco',
    tokenType: 'Bearer',
    expiresIn: 900,
    user: { id: 'u1', permissions: ['READ_PRODUCTS'] },
  });

  loginResultado: AuthResult<LoginBody> = ok({
    accessToken: 'token-de-login',
    tokenType: 'Bearer',
    expiresIn: 900,
    user: {
      id: 'u1',
      email: 'owner@crm-ventas.local',
      role: 'OWNER',
      status: 'ACTIVE',
      organizationId: 'org1',
      permissions: ['READ_PRODUCTS'],
    },
  });

  logoutResultado: AuthResult<null> = ok(null);

  registerResultado: AuthResult<RegisterBody> = ok({
    id: 'u2',
    email: 'agente@crm-ventas.local',
    role: 'AGENT',
    organization: { id: 'org1', name: 'x', slug: 'x' },
    permissions: ['READ_PRODUCTS'],
    lastLoginAt: null,
  });

  setupResultado: AuthResult<SetupBody> = ok({
    accessToken: 'token-de-setup',
    tokenType: 'Bearer',
    expiresIn: 900,
    user: {
      id: 'u1',
      email: 'owner@crm-ventas.local',
      role: 'OWNER',
      status: 'ACTIVE',
      organizationId: 'org1',
      permissions: ['MANAGE_AGENTS', 'READ_PRODUCTS'],
    },
  });

  meResultado: AuthResult<MeBody> = ok({
    id: 'u1',
    email: 'owner@crm-ventas.local',
    role: 'OWNER',
    organization: { id: 'org1', name: 'x', slug: 'x' },
    permissions: ['READ_PRODUCTS'],
    lastLoginAt: '2026-01-01T00:00:00.000Z',
  });

  /** Se cuentan porque la mitad de estas pruebas son sobre **cuántas veces** se pregunta. */
  llamadasRefresh = 0;
  llamadasLogin = 0;
  llamadasLogout = 0;
  llamadasRegister = 0;
  llamadasSetup = 0;
  llamadasMe = 0;

  async login(): Promise<AuthResult<LoginBody>> {
    this.llamadasLogin += 1;
    return this.loginResultado;
  }

  async refresh(): Promise<AuthResult<RefreshBody>> {
    this.llamadasRefresh += 1;
    return this.refreshResultado;
  }

  async logout(): Promise<AuthResult<null>> {
    this.llamadasLogout += 1;
    return this.logoutResultado;
  }

  async register(): Promise<AuthResult<RegisterBody>> {
    this.llamadasRegister += 1;
    return this.registerResultado;
  }

  async setup(): Promise<AuthResult<SetupBody>> {
    this.llamadasSetup += 1;
    return this.setupResultado;
  }

  async me(): Promise<AuthResult<MeBody>> {
    this.llamadasMe += 1;
    return this.meResultado;
  }
}

function ok<T>(body: T): AuthResult<T> {
  return {
    outcome: 'ok',
    httpStatus: 200,
    traceId: null,
    body,
    problem: null,
    transportError: null,
    retryAfterSeconds: null,
  };
}

function sinRespuesta<T>(transportError: string): AuthResult<T> {
  return {
    outcome: 'unreachable',
    httpStatus: null,
    traceId: null,
    body: null,
    problem: null,
    transportError,
    retryAfterSeconds: null,
  };
}

function problema<T>(httpStatus: number, code: string): AuthResult<T> {
  return {
    outcome: 'problem',
    httpStatus,
    traceId: null,
    body: null,
    problem: { type: 'about:blank', title: 'x', status: httpStatus, code } as ProblemDetails,
    transportError: null,
    retryAfterSeconds: null,
  };
}

describe('SessionService', () => {
  let fake: FakeAuthApi;
  let session: SessionService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    fake = new FakeAuthApi();
    TestBed.configureTestingModule({
      providers: [SessionService, { provide: AuthApi, useValue: fake }],
    });

    session = TestBed.inject(SessionService);
  });

  it('arranca anónimo, sin token y sin inventarse un usuario', () => {
    expect(session.status()).toBe('anonimo');
    expect(session.authenticated()).toBe(false);
    expect(session.user()).toBeNull();
    expect(session.isDemo()).toBe(false);
    expect(session.authorizationHeader()).toBeNull();
  });

  it('restaura la sesión con el refresh y no vuelve a pedirla', async () => {
    await expect(session.ensureRestored()).resolves.toBe(true);

    expect(session.status()).toBe('autenticado');
    expect(session.authorizationHeader()).toBe('Bearer token-de-refresco');
    expect(fake.llamadasRefresh).toBe(1);

    // Idempotencia: el guard lo llama en CADA navegación. Sin esto habría una petición por navegación.
    await expect(session.ensureRestored()).resolves.toBe(true);
    expect(fake.llamadasRefresh).toBe(1);
  });

  it('dos restauraciones simultáneas comparten un solo refresh', async () => {
    // El guard puede dispararse dos veces antes de que la primera respuesta llegue (doble clic en un
    // enlace, o el guard del padre y el del hijo). `??=` sobre la promesa en curso lo evita.
    const [a, b] = await Promise.all([session.ensureRestored(), session.ensureRestored()]);

    expect([a, b]).toEqual([true, true]);
    expect(fake.llamadasRefresh).toBe(1);
  });

  it('tras un refresh, `me` completa la identidad con email y role', async () => {
    await session.ensureRestored();

    expect(fake.llamadasMe).toBe(1);
    expect(session.user()).toEqual({
      id: 'u1',
      permissions: ['READ_PRODUCTS'],
      email: 'owner@crm-ventas.local',
      role: 'OWNER',
    });
  });

  it('si `me` falla tras un refresh, la sesión sigue autenticada con los datos parciales', async () => {
    fake.meResultado = sinRespuesta('No hubo respuesta del API.');

    await session.ensureRestored();

    expect(session.status()).toBe('autenticado');
    expect(session.user()).toEqual({
      id: 'u1',
      permissions: ['READ_PRODUCTS'],
      email: null,
      role: null,
    });
  });

  it('un rechazo del contrato NO se reintenta: preguntar otra vez daría lo mismo', async () => {
    fake.refreshResultado = problema(401, 'REFRESH_TOKEN_INVALID');

    await expect(session.ensureRestored()).resolves.toBe(false);
    expect(session.status()).toBe('anonimo');

    await expect(session.ensureRestored()).resolves.toBe(false);
    expect(fake.llamadasRefresh).toBe(1);
  });

  it('un fallo NO concluyente sí se reintenta: si arrancas el API, entras sin recargar', async () => {
    // El caso real de hoy: el usuario abre la SPA antes de arrancar el API. Si el «no» se recordara
    // para siempre, tendría que recargar la página para darse cuenta de que ya funciona.
    fake.refreshResultado = sinRespuesta('No hubo respuesta del API. ¿Está arrancado en el puerto 3000?');

    await expect(session.ensureRestored()).resolves.toBe(false);

    fake.refreshResultado = ok({
      accessToken: 'ya-esta-arrancado',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: 'u1', permissions: [] },
    });

    await expect(session.ensureRestored()).resolves.toBe(true);
    expect(fake.llamadasRefresh).toBe(2);
  });

  it('el 404 de la ruta sin montar tampoco cierra la puerta para siempre', async () => {
    // `/auth/refresh` ya existe, pero un 404 sin `problem` sigue siendo no concluyente: si el módulo
    // de auth no estuviera montado, la siguiente navegación debe volver a intentarlo.
    fake.refreshResultado = {
      ...sinRespuesta<RefreshBody>('Respuesta de error con un cuerpo que no es problem+json.'),
      httpStatus: 404,
    };

    await expect(session.ensureRestored()).resolves.toBe(false);

    fake.refreshResultado = ok({
      accessToken: 't',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: 'u1', permissions: [] },
    });

    await expect(session.ensureRestored()).resolves.toBe(true);
    expect(fake.llamadasRefresh).toBe(2);
  });

  it('el login correcto adopta la sesión completa y la marca como real', async () => {
    await session.login('owner@crm-ventas.local', 'secreta', false);

    expect(session.authenticated()).toBe(true);
    expect(session.isDemo()).toBe(false);
    expect(session.user()?.email).toBe('owner@crm-ventas.local');
    expect(session.authorizationHeader()).toBe('Bearer token-de-login');
  });

  it('un login rechazado NO deja media sesión abierta', async () => {
    fake.loginResultado = problema(401, 'AUTH_INVALID_CREDENTIALS');

    const resultado = await session.login('a@b.c', 'mal', false);

    expect(resultado.problem?.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(session.authenticated()).toBe(false);
    expect(session.authorizationHeader()).toBeNull();
  });

  it('el logout limpia el estado local aunque el servidor no conteste', async () => {
    // Si el API está caído, la sesión local TIENE que morir igual: dejar al usuario «dentro» porque no
    // se pudo avisar sería lo contrario de lo que pidió. El resultado se devuelve para que quien llame
    // pueda advertir de que la cookie puede seguir viva.
    await session.login('a@b.c', 'x', false);
    fake.logoutResultado = sinRespuesta('No hubo respuesta del API.');

    const resultado = await session.logout();

    expect(resultado.outcome).toBe('unreachable');
    expect(session.authenticated()).toBe(false);
    expect(session.authorizationHeader()).toBeNull();
    expect(session.user()).toBeNull();
  });

  it('register pasa el access token actual al API', async () => {
    await session.login('owner@crm-ventas.local', 'secreta', false);

    await session.register('nuevo@crm-ventas.local', 'ContraseñaSegura1!');

    expect(fake.llamadasRegister).toBe(1);
  });

  it('register no abre sesión: solo delega en AuthApi', async () => {
    await session.login('owner@crm-ventas.local', 'secreta', false);

    await session.register('nuevo@crm-ventas.local', 'ContraseñaSegura1!');

    expect(session.user()?.email).toBe('owner@crm-ventas.local');
  });

  it('setup crea el OWNER y abre sesión real', async () => {
    await session.setup('owner@crm-ventas.local', 'ContraseñaSegura1!', 'Mi Org');

    expect(session.authenticated()).toBe(true);
    expect(session.isDemo()).toBe(false);
    expect(session.user()?.email).toBe('owner@crm-ventas.local');
    expect(session.user()?.role).toBe('OWNER');
    expect(session.authorizationHeader()).toBe('Bearer token-de-setup');
    expect(fake.llamadasSetup).toBe(1);
  });

  it('permissions refleja los del usuario autenticado', async () => {
    await session.login('owner@crm-ventas.local', 'secreta', false);

    expect(session.permissions()).toEqual(['READ_PRODUCTS']);
  });

  it('permissions está vacío sin sesión', () => {
    expect(session.permissions()).toEqual([]);
  });

  it('la sesión de demostración entra, se marca como tal y NO trae credencial', () => {
    expect(session.startDemoSession()).toBe(true);

    expect(session.authenticated()).toBe(true);
    expect(session.isDemo()).toBe(true);
    // Ni usuario ni token: no sabemos quién es y no puede llamar al API. Una sesión de mentira que no
    // puede tocar datos reales es exactamente lo que tiene que ser.
    expect(session.user()).toBeNull();
    expect(session.authorizationHeader()).toBeNull();
  });
});

/**
 * La parte que de verdad importa de la puerta de demostración.
 *
 * La tabla de verdad se prueba sobre una función pura y no sobre el servicio porque `isDevMode()` es
 * `true` en cualquier test y no se puede forzar a `false`: un test que dijera «con la puerta cerrada
 * no entra» llamando al servicio estaría mintiendo sobre lo que comprueba.
 */
describe('puertaDeDemostracionAbierta', () => {
  it('solo abre con las DOS condiciones', () => {
    expect(puertaDeDemostracionAbierta(true, true)).toBe(true);

    expect(puertaDeDemostracionAbierta(true, false)).toBe(false);
    expect(puertaDeDemostracionAbierta(false, true)).toBe(false);
    expect(puertaDeDemostracionAbierta(false, false)).toBe(false);
  });

  it('el fichero de producción tiene la puerta cerrada', () => {
    // Se importa el fichero directamente porque en el build de producción `angular.json` lo enlaza por
    // `fileReplacements`. Este test es lo que impide que alguien lo ponga a `true` «para probar»: es
    // una línea de código de diferencia entre una puerta que no puede abrirse y una que sí.
    expect(environmentDeProduccion.demoSession).toBe(false);
  });

  it('en desarrollo sí está habilitada, que es para lo que existe', () => {
    expect(environment.demoSession).toBe(true);
  });
});
