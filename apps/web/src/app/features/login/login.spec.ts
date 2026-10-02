import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { buildProblem } from '@crm/contracts';
import type { ErrorCode } from '@crm/contracts';
import { describe, expect, it } from 'vitest';

import type { AuthResult, LoginBody } from '../../core/auth-api';
import { SessionService } from '../../core/session';
import { Login } from './login';

/**
 * Pruebas de la pantalla de acceso.
 *
 * Se doblan **las dos** dependencias del componente —`SessionService` y `Router`— porque ninguna de
 * las dos es lo que esta pantalla decide. Lo que se comprueba aquí es: qué se envía, qué se anuncia
 * mientras se espera, qué se enseña cuando falla, dónde acaba el foco y por dónde se sale.
 *
 * Que `/entrar` monte fuera del shell y no rebote contra el redirect se prueba en
 * `app.routes.spec.ts`, con la tabla de rutas de verdad.
 */

const TRACE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

class FakeSession {
  readonly enviados: { email: string; password: string; rememberDevice: boolean }[] = [];

  resultadoLogin: AuthResult<LoginBody> = exito();

  /**
   * Con esto, `login()` se queda en el aire y es la prueba quien decide cuándo termina.
   *
   * Hace falta para poder mirar la pantalla **mientras** se está enviando: es el único momento en el
   * que la región de estado tiene algo que decir, y con una promesa ya resuelta nunca se llega a ver.
   */
  manual = false;

  abrirDemo = true;
  demos = 0;

  #terminar: ((resultado: AuthResult<LoginBody>) => void) | null = null;

  login(email: string, password: string, rememberDevice: boolean): Promise<AuthResult<LoginBody>> {
    this.enviados.push({ email, password, rememberDevice });

    if (!this.manual) {
      return Promise.resolve(this.resultadoLogin);
    }

    return new Promise<AuthResult<LoginBody>>((resolver) => {
      this.#terminar = resolver;
    });
  }

  terminando(resultado: AuthResult<LoginBody>): void {
    this.#terminar?.(resultado);
    this.#terminar = null;
  }

  startDemoSession(): boolean {
    this.demos += 1;
    return this.abrirDemo;
  }
}

class FakeRouter {
  readonly destinos: string[] = [];

  navigateByUrl(url: string): Promise<boolean> {
    this.destinos.push(url);
    return Promise.resolve(true);
  }
}

/**
 * La ruta activa, reducida a lo único que esta pantalla lee: el `returnTo` con el que el guard la
 * trajo aquí.
 *
 * Es la parte de la URL que el usuario puede escribir a mano, así que el conjunto de valores que se
 * prueba aquí no es una colección de casos bonitos: son los intentos de open redirect.
 */
class FakeRuta {
  returnTo: string | null = null;

  readonly snapshot = {
    queryParamMap: {
      get: (clave: string): string | null => (clave === 'returnTo' ? this.returnTo : null),
    },
  };
}

function exito(): AuthResult<LoginBody> {
  return {
    outcome: 'ok',
    httpStatus: 200,
    traceId: TRACE,
    body: {
      accessToken: 'token-de-acceso',
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
    },
    problem: null,
    transportError: null,
    retryAfterSeconds: null,
  };
}

/** Un error del contrato, construido con el mismo constructor que usa el API: `status` sale del catálogo. */
function delContrato(code: ErrorCode, retryAfterSeconds: number | null = null): AuthResult<LoginBody> {
  const problem = buildProblem({
    code,
    detail: 'Detalle del servidor.',
    instance: '/api/v1/auth/login',
    traceId: TRACE,
  });

  return {
    outcome: 'problem',
    httpStatus: problem.status,
    traceId: TRACE,
    body: null,
    problem,
    transportError: null,
    retryAfterSeconds,
  };
}

/**
 * El estado real de hoy: la ruta no está montada, así que el 404 por defecto de Nest llega **sin**
 * `problem+json`. Ver `core/auth-api.ts`.
 */
function sinMontar(): AuthResult<LoginBody> {
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

function sinRespuesta(transportError: string): AuthResult<LoginBody> {
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

interface Escenario {
  readonly fixture: ComponentFixture<Login>;
  readonly el: HTMLElement;
  readonly session: FakeSession;
  readonly router: FakeRouter;
  readonly ruta: FakeRuta;
}

/**
 * Deja correr la aplicación y repinta.
 *
 * Tres pasos y los tres hacen falta: `whenStable()` no sigue las microtareas que resuelven las
 * promesas del componente, `fixture.detectChanges()` es lo que ejecuta el repintado (en zoneless
 * llama a `ApplicationRef.tick()`, que es también lo que dispara los `afterNextRender`) y el
 * macrotask deja correr la continuación que va **después** de ese repintado — el `focus()`.
 */
async function asentar(fixture: ComponentFixture<Login>): Promise<void> {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

async function montar(
  session = new FakeSession(),
  ruta = new FakeRuta(),
): Promise<Escenario> {
  TestBed.resetTestingModule();

  const router = new FakeRouter();

  TestBed.configureTestingModule({
    imports: [Login],
    providers: [
      { provide: SessionService, useValue: session },
      { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: ruta },
    ],
  });

  const fixture = TestBed.createComponent(Login);
  await asentar(fixture);

  return { fixture, el: fixture.nativeElement as HTMLElement, session, router, ruta };
}

/** Monta con un `returnTo` ya puesto en la URL, como lo dejaría el guard. */
function montarVolviendoA(destino: string): Promise<Escenario> {
  const ruta = new FakeRuta();
  ruta.returnTo = destino;

  return montar(new FakeSession(), ruta);
}

/**
 * Rellena y envía.
 *
 * El envío se dispara con un evento a mano y no con `requestSubmit()`: eso último activa la
 * validación del navegador, y estas pruebas no quieren depender de que jsdom implemente `minlength`
 * igual que Chrome.
 */
function enviar(el: HTMLElement, email: string, password: string): void {
  el.querySelector<HTMLInputElement>('#acceso-email')!.value = email;
  el.querySelector<HTMLInputElement>('#acceso-password')!.value = password;

  el.querySelector('form')!.dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  );
}

describe('Acceso — la honestidad de la pantalla', () => {
  it('el aviso de que no autentica a nadie está siempre, no solo cuando algo falla', async () => {
    // Es lo único que separa esta pantalla de una frontera de seguridad falsa. Si este texto
    // desaparece, la pantalla pasa a afirmar algo que no es cierto.
    const { el } = await montar();

    const aviso = el.querySelector('.note--warn');
    expect(aviso?.textContent).toContain('todavía no autentica a nadie');
    expect(aviso?.textContent).toContain('Hito 2');
    expect(aviso?.textContent).toContain('404');
  });

  it('declara la política de contraseña del servidor y el autocompletado correcto', async () => {
    // Los límites no son decorativos: son los de `docs/security.md` §2.1. Y `autocomplete` es lo que
    // hace que un gestor de contraseñas rellene en vez de pelearse con el campo.
    const { el } = await montar();

    const clave = el.querySelector<HTMLInputElement>('#acceso-password')!;
    const correo = el.querySelector<HTMLInputElement>('#acceso-email')!;

    expect(clave.minLength).toBe(12);
    expect(clave.maxLength).toBe(128);
    expect(clave.getAttribute('autocomplete')).toBe('current-password');
    expect(correo.getAttribute('autocomplete')).toBe('username');
    expect(correo.getAttribute('type')).toBe('email');
    expect(el.querySelector('.field__hint')?.textContent).toContain('12 y 128');
  });
});

describe('Acceso — el envío', () => {
  it('envía lo escrito, recorta el correo y no inventa un `rememberDevice`', async () => {
    const { fixture, el, session } = await montar();

    enviar(el, '  owner@crm-ventas.local  ', '  una contraseña larga  ');
    await asentar(fixture);

    // La contraseña NO se recorta (los espacios pueden ser parte de ella); el correo sí, porque un
    // espacio al final es un error de copiar y pegar que el servidor rechazaría sin explicar por qué.
    expect(session.enviados).toEqual([
      {
        email: 'owner@crm-ventas.local',
        password: '  una contraseña larga  ',
        rememberDevice: false,
      },
    ]);
  });

  it('mientras espera lo anuncia en la región de estado y deshabilita el botón', async () => {
    const { fixture, el, session } = await montar();
    session.manual = true;

    enviar(el, 'a@crm-ventas.local', 'contraseña-larga');
    await asentar(fixture);

    const estado = el.querySelector('[role="status"]');
    const boton = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    expect(estado?.textContent).toContain('Entrando');
    expect(boton.disabled).toBe(true);
    // La etiqueta no se mueve: el estado ya se anuncia arriba, y un nombre de botón que cambia bajo
    // el dedo es una trampa conocida.
    expect(boton.textContent).toContain('Entrar');
    expect(boton.textContent).not.toContain('Entrando');
  });

  it('un segundo envío con el primero en vuelo no suma otro intento de acceso', async () => {
    // Cada intento fallido cuenta para el bloqueo de la cuenta: dos envíos del mismo clic son un
    // intento regalado al contador.
    const { fixture, el, session } = await montar();
    session.manual = true;

    enviar(el, 'a@crm-ventas.local', 'contraseña-larga');
    await asentar(fixture);
    enviar(el, 'a@crm-ventas.local', 'contraseña-larga');
    await asentar(fixture);

    expect(session.enviados).toHaveLength(1);
  });

  it('un acceso correcto navega al inicio y no deja rastro de error', async () => {
    const { fixture, el, session, router } = await montar();

    session.resultadoLogin = exito();
    enviar(el, 'owner@crm-ventas.local', 'contraseña-larga');
    await asentar(fixture);

    expect(router.destinos).toEqual(['/leads']);
    expect(el.querySelector('#acceso-error')).toBeNull();
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  });
});

describe('Acceso — los fallos', () => {
  it('el 404 de la ruta sin montar se explica con el estado real del proyecto', async () => {
    const { fixture, el, session } = await montar();

    session.resultadoLogin = sinMontar();
    enviar(el, 'a@crm-ventas.local', 'contraseña-larga');
    await asentar(fixture);

    const error = el.querySelector('#acceso-error');
    expect(error?.textContent).toContain('Hito 2');
    // Tono informativo, no de error: no es culpa de quien lo lee ni tiene arreglo por su parte.
    expect(error?.classList.contains('note--warn')).toBe(true);
    expect(error?.classList.contains('alert--bad')).toBe(false);
  });

  it('las credenciales inválidas marcan los campos y enlazan el resumen de error', async () => {
    const { fixture, el, session } = await montar();

    session.resultadoLogin = delContrato('AUTH_INVALID_CREDENTIALS');
    enviar(el, 'a@crm-ventas.local', 'contraseña-larga');
    await asentar(fixture);

    const error = el.querySelector('#acceso-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.classList.contains('alert--bad')).toBe(true);
    expect(el.querySelector('#acceso-email')?.getAttribute('aria-invalid')).toBe('true');
    // El correo no tiene ayuda propia; la contraseña sí, y las dos descripciones se suman.
    expect(el.querySelector('#acceso-email')?.getAttribute('aria-describedby')).toBe('acceso-error');
    expect(el.querySelector('#acceso-password')?.getAttribute('aria-describedby')).toBe(
      'acceso-password-ayuda acceso-error',
    );
  });

  it('un fallo de red NO declara inválidos unos campos que están bien', async () => {
    const { fixture, el, session } = await montar();

    session.resultadoLogin = sinRespuesta(
      'No hubo respuesta del API. ¿Está arrancado en el puerto 3000?',
    );
    enviar(el, 'a@crm-ventas.local', 'contraseña-larga');
    await asentar(fixture);

    expect(el.querySelector('#acceso-error')?.textContent).toContain('puerto 3000');
    expect(el.querySelector('#acceso-email')?.getAttribute('aria-invalid')).toBeNull();
    // Y el `aria-describedby` sigue apuntando solo a la ayuda que existe: un id colgando es peor que
    // ningún id.
    expect(el.querySelector('#acceso-password')?.getAttribute('aria-describedby')).toBe(
      'acceso-password-ayuda',
    );
  });

  it('un código que esta pantalla no espera deja el `traceId` a la vista', async () => {
    // Ante lo no previsto, lo único útil es el dato que permite buscar la traza en los logs.
    const { fixture, el, session } = await montar();

    session.resultadoLogin = delContrato('INTERNAL_ERROR');
    enviar(el, 'a@crm-ventas.local', 'contraseña-larga');
    await asentar(fixture);

    const error = el.querySelector('#acceso-error');
    expect(error?.textContent).toContain('INTERNAL_ERROR');
    expect(error?.textContent).toContain(TRACE);
  });

  it('tras un fallo el foco se mueve al resumen, y no se queda en el formulario', async () => {
    // Sin esto, quien navega con teclado se queda en unos campos que acaban de fallar sin enterarse
    // de por qué. Y es lo único que verifica que el `afterNextRender` está donde tiene que estar: si
    // alguien lo cambia por un `setTimeout`, esto se pone en rojo.
    const { fixture, el, session } = await montar();

    session.resultadoLogin = delContrato('AUTH_INVALID_CREDENTIALS');
    enviar(el, 'a@crm-ventas.local', 'contraseña-larga');
    await asentar(fixture);
    // Un macrotask más: el `focus()` va en la continuación que resuelve `afterNextRender`.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.activeElement).toBe(el.querySelector('#acceso-error'));
  });
});

describe('Acceso — la vuelta a la pantalla que pedía sesión', () => {
  it('vuelve a la pantalla pedida, con sus filtros, y no al inicio', async () => {
    // Cuando el guard trae aquí desde `/leads?estado=nuevo`, entrar y aparecer en otro sitio es
    // perder el trabajo de haber filtrado. La query y el fragmento viajan con la ruta.
    const { fixture, el, session, router } = await montarVolviendoA('/leads?estado=nuevo#tabla');

    session.resultadoLogin = exito();
    enviar(el, 'owner@crm-ventas.local', 'contraseña-larga');
    await asentar(fixture);

    expect(router.destinos).toEqual(['/leads?estado=nuevo#tabla']);
  });

  it('la puerta de demostración también respeta el destino pedido', async () => {
    const { fixture, el, router } = await montarVolviendoA('/sistema');

    el.querySelector<HTMLButtonElement>('.acceso__demo button')?.click();
    await asentar(fixture);

    expect(router.destinos).toEqual(['/sistema']);
  });

  it.each([
    ['una URL absoluta', 'https://sitio-malicioso.test'],
    ['una URL relativa al protocolo', '//sitio-malicioso.test'],
    ['una barra invertida, que es separador en los esquemas especiales', '/\\sitio-malicioso.test'],
    ['un salto de línea escondido antes de las barras', '/\n/sitio-malicioso.test'],
  ])('un `returnTo` con %s se ignora en favor del inicio', async (_caso, destino) => {
    // Sin esto, `/entrar?returnTo=https://sitio-malicioso.test` convierte el acceso en un trampolín:
    // la pantalla que inspira confianza es la que te lleva a otro sitio. La lista no es de casos
    // raros: cada línea es una forma distinta de escribir «otro host» que un navegador interpreta
    // como tal.
    const { fixture, el, session, router } = await montarVolviendoA(destino);

    session.resultadoLogin = exito();
    enviar(el, 'owner@crm-ventas.local', 'contraseña-larga');
    await asentar(fixture);

    expect(router.destinos).toEqual(['/leads']);
  });

  it('volver al propio acceso sería un bucle, así que se va al inicio', async () => {
    const { fixture, el, session, router } = await montarVolviendoA('/entrar');

    session.resultadoLogin = exito();
    enviar(el, 'owner@crm-ventas.local', 'contraseña-larga');
    await asentar(fixture);

    expect(router.destinos).toEqual(['/leads']);
  });
});

describe('Acceso — la puerta de demostración', () => {
  it('entra sin credencial y navega al inicio', async () => {
    const { fixture, el, session, router } = await montar();

    el.querySelector<HTMLButtonElement>('.acceso__demo button')?.click();
    await asentar(fixture);

    expect(session.demos).toBe(1);
    expect(router.destinos).toEqual(['/leads']);
  });

  it('si la puerta está cerrada, pulsarla no entra ni navega', async () => {
    // El `false` de `startDemoSession()` tiene que parar la navegación: si no, la mitad de la doble
    // condición no serviría de nada.
    const { fixture, el, session, router } = await montar();
    session.abrirDemo = false;

    el.querySelector<HTMLButtonElement>('.acceso__demo button')?.click();
    await asentar(fixture);

    expect(session.demos).toBe(1);
    expect(router.destinos).toEqual([]);
    expect(el.querySelector('#acceso-error')).toBeNull();
  });
});
