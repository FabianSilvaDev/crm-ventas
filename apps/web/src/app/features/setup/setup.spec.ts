import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { buildProblem } from '@crm/contracts';
import type { ErrorCode } from '@crm/contracts';
import { describe, expect, it } from 'vitest';

import type { AuthResult, SetupBody } from '../../core/auth-api';
import { SessionService } from '../../core/session';
import { Setup } from './setup';

/**
 * Pruebas de la pantalla de setup inicial.
 *
 * Se doblan `SessionService` y `Router`: lo que se decide aquí es validar contraseñas,
 * enviar al backend, pintar errores y redirigir tras crear el OWNER.
 */

const TRACE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

class FakeSession {
  enviados: { email: string; password: string; organizationName?: string }[] = [];
  resultadoSetup: AuthResult<SetupBody> = exito();

  async setup(
    email: string,
    password: string,
    organizationName?: string,
  ): Promise<AuthResult<SetupBody>> {
    this.enviados.push({ email, password, organizationName });
    return this.resultadoSetup;
  }
}

class FakeRouter {
  readonly destinos: string[] = [];

  navigateByUrl(url: string): Promise<boolean> {
    this.destinos.push(url);
    return Promise.resolve(true);
  }
}

function exito(): AuthResult<SetupBody> {
  return {
    outcome: 'ok',
    httpStatus: 200,
    traceId: TRACE,
    body: {
      accessToken: 'token-nuevo',
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
    },
    problem: null,
    transportError: null,
    retryAfterSeconds: null,
  };
}

function delContrato(code: ErrorCode): AuthResult<SetupBody> {
  const problem = buildProblem({
    code,
    detail: 'Detalle del servidor.',
    instance: '/api/v1/auth/setup',
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
  readonly fixture: ComponentFixture<Setup>;
  readonly el: HTMLElement;
  readonly session: FakeSession;
  readonly router: FakeRouter;
}

async function asentar(fixture: ComponentFixture<Setup>): Promise<void> {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

async function montar(session = new FakeSession(), router = new FakeRouter()): Promise<Escenario> {
  TestBed.resetTestingModule();

  TestBed.configureTestingModule({
    imports: [Setup],
    providers: [
      { provide: SessionService, useValue: session },
      { provide: Router, useValue: router },
    ],
  });

  const fixture = TestBed.createComponent(Setup);
  await asentar(fixture);

  return { fixture, el: fixture.nativeElement as HTMLElement, session, router };
}

function enviar(
  el: HTMLElement,
  email: string,
  organizationName: string,
  password: string,
  confirm: string,
): void {
  el.querySelector<HTMLInputElement>('#setup-email')!.value = email;
  el.querySelector<HTMLInputElement>('#setup-organization')!.value = organizationName;
  el.querySelector<HTMLInputElement>('#setup-password')!.value = password;
  el.querySelector<HTMLInputElement>('#setup-password-confirm')!.value = confirm;

  el.querySelector('form')!.dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  );
}

describe('Setup — validación', () => {
  it('envía email, organización y contraseña', async () => {
    const { fixture, el, session } = await montar();

    enviar(
      el,
      'nuevo-owner@crm-ventas.local',
      'Mi Negocio',
      'ContraseñaSegura1!',
      'ContraseñaSegura1!',
    );
    await asentar(fixture);

    expect(session.enviados).toEqual([
      {
        email: 'nuevo-owner@crm-ventas.local',
        organizationName: 'Mi Negocio',
        password: 'ContraseñaSegura1!',
      },
    ]);
  });

  it('no envía si las contraseñas no coinciden', async () => {
    const { fixture, el, session } = await montar();

    enviar(el, 'a@b.c', 'Org', 'ContraseñaSegura1!', 'OtraContraseña2!');
    await asentar(fixture);

    expect(session.enviados.length).toBe(0);
    expect(el.textContent).toContain('no coinciden');
  });

  it('rechaza una contraseña sin mayúscula', async () => {
    const { fixture, el, session } = await montar();

    enviar(el, 'a@b.c', 'Org', 'contraseñasegura1!', 'contraseñasegura1!');
    await asentar(fixture);

    expect(session.enviados.length).toBe(0);
    expect(el.textContent).toContain('mayúscula');
  });
});

describe('Setup — resultado', () => {
  it('redirige a /home tras éxito', async () => {
    const { fixture, el, router } = await montar();

    enviar(el, 'owner@crm-ventas.local', 'Org', 'ContraseñaSegura1!', 'ContraseñaSegura1!');
    await asentar(fixture);

    expect(router.destinos).toContain('/home');
  });

  it('pinta un error del servidor con su código', async () => {
    const { fixture, el, session } = await montar();
    session.resultadoSetup = delContrato('STATE_CONFLICT');

    enviar(el, 'a@b.c', 'Org', 'ContraseñaSegura1!', 'ContraseñaSegura1!');
    await asentar(fixture);

    expect(el.querySelector('#setup-error')?.textContent).toContain('STATE_CONFLICT');
    expect(el.querySelector('#setup-error')?.textContent).toContain(TRACE);
  });

  it('el enlace a login navega a /entrar', async () => {
    const { el, router } = await montar();

    el.querySelector<HTMLButtonElement>('.acceso__demo button')!.click();

    expect(router.destinos).toContain('/entrar');
  });
});
