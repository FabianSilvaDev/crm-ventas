import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';

import { routes } from './app.routes';
import { AuthApi } from './core/auth-api';
import type { AuthResult, RefreshBody } from './core/auth-api';

/**
 * Comprobación de la estructura de rutas, no de una pantalla concreta.
 *
 * Existe por cuatro motivos que no cubre ningún otro test:
 *
 * 1. **El enlace profundo.** Entrar directamente a `/sistema` (o recargar en esa URL) tiene que
 *    montar el shell y la pantalla. Es un fallo silencioso: la aplicación arranca, no hay error,
 *    y el usuario ve una página en blanco.
 * 2. **El bucle de redirección.** El padre tiene `path: ''` y un hijo `'**'`, así que se traga
 *    cualquier URL. `/entrar` está declarada por delante justo por eso; un reordenado la haría
 *    rebotar contra el redirect en un ciclo, y el acceso sería inalcanzable.
 * 3. **El cierre del shell.** Desde que existe el guard, una URL profunda sin sesión tiene que
 *    acabar en el acceso y **no** montar la navegación. Es lo contrario del punto 1 y hay que
 *    probar los dos lados: un guard que no deja entrar a nadie deja la aplicación inservible y
 *    ninguno de los otros tests se enteraría.
 * 4. **La vuelta.** El guard guarda la URL pedida en `returnTo`; si se perdiera, entrar desde un
 *    enlace profundo dejaría al usuario en otra pantalla y parecería que el enlace no funcionó.
 *
 * Se hace con el router de verdad y los componentes reales (perezosos incluidos): una aserción
 * sobre el array de rutas comprobaría que el fichero dice lo que dice, no que la aplicación navegue.
 *
 * El guard usa el `SessionService` **de verdad** —doblar el servicio entero probaría que el guard
 * llama a un doble, no que la frontera funcione— y lo único que se dobla es el transporte: `AuthApi`.
 * Así el camino que se recorre es el real: guard → `ensureRestored()` → `refresh()` → estado.
 */

const TRACE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

class FakeAuthApi {
  /** Por defecto, el estado real de hoy: la ruta no está montada. */
  resultadoRefresh: AuthResult<RefreshBody> = sinSesion();

  refresh(): Promise<AuthResult<RefreshBody>> {
    return Promise.resolve(this.resultadoRefresh);
  }
}

/** `POST /auth/refresh` no existe todavía: Nest responde su 404 por defecto, sin problem+json. */
function sinSesion(): AuthResult<RefreshBody> {
  return {
    outcome: 'unreachable',
    httpStatus: 404,
    traceId: null,
    body: null,
    problem: null,
    transportError: 'Respuesta de error con un cuerpo que no es problem+json.',
    retryAfterSeconds: null,
  };
}

function conSesion(): AuthResult<RefreshBody> {
  return {
    outcome: 'ok',
    httpStatus: 200,
    traceId: TRACE,
    body: {
      accessToken: 'token-de-acceso',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: 'u1', permissions: ['READ_PRODUCTS'] },
    },
    problem: null,
    transportError: null,
    retryAfterSeconds: null,
  };
}

interface Escenario {
  readonly el: HTMLElement;
  readonly router: Router;
}

async function montar(url: string, auth = new FakeAuthApi()): Promise<Escenario> {
  TestBed.resetTestingModule();

  await TestBed.configureTestingModule({
    providers: [provideRouter(routes), { provide: AuthApi, useValue: auth }],
  }).compileComponents();

  const harness = await RouterTestingHarness.create(url);

  return { el: harness.routeNativeElement as HTMLElement, router: TestBed.inject(Router) };
}

/** El `returnTo` tal como quedó en la barra de direcciones, ya decodificado. */
function vueltaPedida(router: Router): unknown {
  return router.parseUrl(router.url).queryParams['returnTo'];
}

/** El shell nuevo no usa `#nav-principal`; usamos una clase propia del layout. */
function shellMontado(el: HTMLElement): boolean {
  return el.querySelector('.topbar') !== null;
}

describe('Rutas — el acceso', () => {
  it('/entrar monta el acceso y NO el shell, sin rebotar contra el redirect', async () => {
    const { el } = await montar('/entrar');

    expect(el.querySelector('main.acceso')).not.toBeNull();
    expect(shellMontado(el)).toBe(false);
    expect(el.querySelector('.skip-link')).toBeNull();
    expect(el.textContent).toContain('todavía no autentica a nadie');
  });
});

describe('Rutas — el shell, con sesión', () => {
  it('un enlace profundo a /sistema monta el shell y la pantalla', async () => {
    const auth = new FakeAuthApi();
    auth.resultadoRefresh = conSesion();

    const { el } = await montar('/sistema', auth);

    expect(shellMontado(el)).toBe(true);
    expect(el.textContent).toContain('Estado del sistema');
  });

  it('un enlace profundo a /leads monta el shell y la pantalla', async () => {
    const auth = new FakeAuthApi();
    auth.resultadoRefresh = conSesion();

    const { el } = await montar('/leads', auth);

    expect(shellMontado(el)).toBe(true);
    expect(el.querySelector('#contenido')).not.toBeNull();
  });

  it('la raíz redirige a /home y no deja el área de trabajo vacía', async () => {
    const auth = new FakeAuthApi();
    auth.resultadoRefresh = conSesion();

    const { el } = await montar('/', auth);

    expect(shellMontado(el)).toBe(true);
    expect(el.textContent).toContain('Inicio');
  });

  it('una URL desconocida cae en una pantalla y no en un callejón sin salida', async () => {
    const auth = new FakeAuthApi();
    auth.resultadoRefresh = conSesion();

    const { el } = await montar('/no-existe-todavia', auth);

    expect(shellMontado(el)).toBe(true);
    expect(el.textContent).toContain('Inicio');
  });

  it('las rutas de las nuevas áreas mentales montan el shell y su título', async () => {
    const auth = new FakeAuthApi();
    auth.resultadoRefresh = conSesion();

    const rutas = [
      { url: '/home', titulo: 'Inicio' },
      { url: '/growth', titulo: 'Growth' },
      { url: '/sales', titulo: 'Ventas' },
      { url: '/products', titulo: 'Productos' },
      { url: '/ai', titulo: 'IA' },
      { url: '/analytics', titulo: 'Analytics' },
      { url: '/settings', titulo: 'Configuración' },
    ] as const;

    for (const r of rutas) {
      const { el } = await montar(r.url, auth);
      expect(shellMontado(el), `${r.url} no montó el shell`).toBe(true);
      expect(el.textContent, `${r.url} no mostró el título`).toContain(r.titulo);
    }
  });

  it('las rutas viejas redirigen a las nuevas áreas mentales', async () => {
    const auth = new FakeAuthApi();
    auth.resultadoRefresh = conSesion();

    const redirects = [
      { url: '/panel', titulo: 'Inicio' },
      { url: '/investigacion', titulo: 'Productos' },
      { url: '/estrategia', titulo: 'Growth' },
      { url: '/adquisicion', titulo: 'Growth' },
      { url: '/ventas', titulo: 'Ventas' },
      { url: '/aprendizaje', titulo: 'Analytics' },
    ] as const;

    for (const r of redirects) {
      const { el } = await montar(r.url, auth);
      expect(shellMontado(el), `${r.url} no montó el shell`).toBe(true);
      expect(el.textContent, `${r.url} no redirigió correctamente`).toContain(r.titulo);
    }
  });
});

describe('Rutas — el cierre', () => {
  it('sin sesión, un enlace profundo a /leads acaba en el acceso y no monta el shell', async () => {
    const { el } = await montar('/leads');

    expect(el.querySelector('main.acceso')).not.toBeNull();
    expect(shellMontado(el)).toBe(false);
  });

  it('y guarda a dónde iba, para devolverlo después de entrar', async () => {
    const { router } = await montar('/leads?estado=nuevo');

    expect(router.url.startsWith('/entrar')).toBe(true);
    expect(vueltaPedida(router)).toBe('/leads?estado=nuevo');
  });

  it('otra pantalla protegida cualquiera queda detrás del mismo guard', async () => {
    const { el } = await montar('/sistema');

    expect(el.querySelector('main.acceso')).not.toBeNull();
    expect(el.textContent).not.toContain('Estado del sistema');
  });

  it('la raíz tampoco se cuela por el redirect del hijo', async () => {
    const { el } = await montar('/');

    expect(el.querySelector('main.acceso')).not.toBeNull();
    expect(shellMontado(el)).toBe(false);
  });
});
