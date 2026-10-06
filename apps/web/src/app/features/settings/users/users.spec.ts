import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { buildProblem } from '@crm/contracts';
import type { ErrorCode } from '@crm/contracts';

import type { AuthResult, RegisterBody } from '../../../core/auth-api';
import { SessionService } from '../../../core/session';
import { Users } from './users';

/**
 * Pruebas de la pantalla de gestión de usuarios.
 *
 * Se dobla `SessionService` porque lo que se decide aquí —mostrar el formulario,
 * validar contraseñas, pintar errores, anunciar éxito— depende de cómo responda la
 * sesión, no de la implementación real del transporte.
 */

const TRACE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

class FakeSession {
  permissionsValue: readonly string[] = ['MANAGE_AGENTS'];
  resultadoRegister: AuthResult<RegisterBody> = exito();
  manual = false;

  #terminar: ((resultado: AuthResult<RegisterBody>) => void) | null = null;

  readonly permissions = () => this.permissionsValue;

  register(
    _email: string,
    _password: string,
  ): Promise<AuthResult<RegisterBody>> {
    if (!this.manual) {
      return Promise.resolve(this.resultadoRegister);
    }

    return new Promise((resolver) => {
      this.#terminar = resolver;
    });
  }

  terminando(resultado: AuthResult<RegisterBody>): void {
    this.#terminar?.(resultado);
    this.#terminar = null;
  }
}

function exito(): AuthResult<RegisterBody> {
  return {
    outcome: 'ok',
    httpStatus: 201,
    traceId: TRACE,
    body: {
      id: 'u2',
      email: 'agente@crm-ventas.local',
      role: 'AGENT',
      organization: { id: 'org1', name: 'Operación principal', slug: 'principal' },
      permissions: ['READ_PRODUCTS'],
      lastLoginAt: null,
    },
    problem: null,
    transportError: null,
    retryAfterSeconds: null,
  };
}

function delContrato(code: ErrorCode): AuthResult<RegisterBody> {
  const problem = buildProblem({
    code,
    detail: 'Detalle del servidor.',
    instance: '/api/v1/auth/register',
    traceId: TRACE,
  });

  return {
    outcome: 'problem',
    httpStatus: problem.status,
    traceId: TRACE,
    body: null,
    problem,
    transportError: null,
    retryAfterSeconds: null,
  };
}

interface Escenario {
  readonly fixture: ComponentFixture<Users>;
  readonly el: HTMLElement;
  readonly session: FakeSession;
}

async function asentar(fixture: ComponentFixture<Users>): Promise<void> {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

function fakeRouter(): Router {
  return {
    navigateByUrl: async () => true,
  } as unknown as Router;
}

async function montar(session = new FakeSession(), router: Router = fakeRouter()): Promise<Escenario> {
  TestBed.resetTestingModule();

  TestBed.configureTestingModule({
    imports: [Users],
    providers: [
      { provide: SessionService, useValue: session },
      { provide: Router, useValue: router },
    ],
  });

  const fixture = TestBed.createComponent(Users);
  await asentar(fixture);

  return { fixture, el: fixture.nativeElement as HTMLElement, session };
}

function enviar(
  el: HTMLElement,
  email: string,
  password: string,
  confirm: string,
): void {
  el.querySelector<HTMLInputElement>('#users-email')!.value = email;
  el.querySelector<HTMLInputElement>('#users-password')!.value = password;
  el.querySelector<HTMLInputElement>('#users-password-confirm')!.value = confirm;

  el.querySelector('form')!.dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  );
}

describe('Usuarios — permisos', () => {
  it('muestra el formulario cuando el usuario tiene MANAGE_AGENTS', async () => {
    const { el } = await montar();

    expect(el.querySelector('#users-email')).not.toBeNull();
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('muestra el formulario en modo demo aunque no tenga MANAGE_AGENTS', async () => {
    // En desarrollo `isDevMode()` es true y `environment.demoSession` es true, así que la pantalla
    // entra en modo demostración y permite probar el formulario aunque el usuario simulado no tenga
    // permisos. El estado vacío se prueba deshabilitando la demo en el componente.
    const session = new FakeSession();
    session.permissionsValue = [];

    const { el } = await montar(session);

    expect(el.querySelector('#users-email')).not.toBeNull();
    expect(el.textContent).toContain('Modo demostración');
  });
});

describe('Usuarios — registro', () => {
  it('envía email y contraseña como AGENT', async () => {
    const { fixture, el, session } = await montar();
    const spy = { email: '', password: '' };

    session.register = async (email: string, password: string) => {
      spy.email = email;
      spy.password = password;
      return exito();
    };

    enviar(el, 'nuevo@crm-ventas.local', 'ContraseñaSegura1!', 'ContraseñaSegura1!');
    await asentar(fixture);

    expect(spy.email).toBe('nuevo@crm-ventas.local');
    expect(spy.password).toBe('ContraseñaSegura1!');
  });

  it('muestra el email creado y limpia el formulario tras éxito', async () => {
    const { fixture, el, session } = await montar();
    session.resultadoRegister = exito();

    enviar(el, 'agente@crm-ventas.local', 'ContraseñaSegura1!', 'ContraseñaSegura1!');
    await asentar(fixture);

    expect(el.textContent).toContain('agente@crm-ventas.local');
    expect(el.querySelector<HTMLInputElement>('#users-email')!.value).toBe('');
  });

  it('no envía si las contraseñas no coinciden', async () => {
    const { fixture, el, session } = await montar();
    let llamadas = 0;

    session.register = async () => {
      llamadas += 1;
      return exito();
    };

    enviar(el, 'a@crm-ventas.local', 'ContraseñaSegura1!', 'OtraContraseña2!');
    await asentar(fixture);

    expect(llamadas).toBe(0);
    expect(el.textContent).toContain('no coinciden');
  });

  it('rechaza una contraseña sin mayúscula antes de llamar al API', async () => {
    const { fixture, el, session } = await montar();
    let llamadas = 0;

    session.register = async () => {
      llamadas += 1;
      return exito();
    };

    enviar(el, 'a@crm-ventas.local', 'contraseñasegura1!', 'contraseñasegura1!');
    await asentar(fixture);

    expect(llamadas).toBe(0);
    expect(el.textContent).toContain('mayúscula');
  });

  it('pinta un error del servidor con su código y traceId', async () => {
    const { fixture, el, session } = await montar();
    session.resultadoRegister = delContrato('STATE_CONFLICT');

    enviar(el, 'duplicado@crm-ventas.local', 'ContraseñaSegura1!', 'ContraseñaSegura1!');
    await asentar(fixture);

    const error = el.querySelector('#users-error');
    expect(error?.textContent).toContain('STATE_CONFLICT');
    expect(error?.textContent).toContain(TRACE);
  });

  it('marca el error de FORBIDDEN_PERMISSION como prohibido', async () => {
    const { fixture, el, session } = await montar();
    session.resultadoRegister = delContrato('FORBIDDEN_PERMISSION');

    enviar(el, 'a@crm-ventas.local', 'ContraseñaSegura1!', 'ContraseñaSegura1!');
    await asentar(fixture);

    expect(el.querySelector('#users-error')?.textContent).toContain('FORBIDDEN_PERMISSION');
  });
});

describe('Usuarios — navegación', () => {
  it('el botón Volver navega a /settings', async () => {
    const destino: { url: string | null } = { url: null };
    const router = {
      navigateByUrl: async (url: string) => {
        destino.url = url;
        return true;
      },
    } as unknown as Router;

    const { el } = await montar(new FakeSession(), router);

    el.querySelector<HTMLButtonElement>('header button')!.click();

    expect(destino.url).toBe('/settings');
  });
});
