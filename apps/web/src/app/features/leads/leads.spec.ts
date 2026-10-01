import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { buildProblem } from '@crm/contracts';
import type { Lead } from '@crm/contracts';
import { describe, expect, it } from 'vitest';

import { LeadsApi } from '../../core/leads-api';
import type { LeadsResult } from '../../core/leads-api';
import { Leads } from './leads';

/**
 * La regla de negocio de esta pantalla no es «pinta una tabla»: es **no afirmar lo que no se puede
 * comprobar**. Sin base de datos, el endpoint no existe, así que la prueba central es que la pantalla
 * lo dice en vez de rellenar el hueco con datos inventados. Los leads de mentira viven aquí, en los
 * tests, y en ningún otro sitio.
 */

class FakeLeadsApi {
  constructor(private readonly result: LeadsResult) {}

  list(): Promise<LeadsResult> {
    return Promise.resolve(this.result);
  }
}

const TRACE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

const UUID_LEAD = '33333333-3333-4333-8333-333333333333';
const UUID_IDENTIDAD = '22222222-2222-4222-8222-222222222222';

function lead(cambios: Partial<Lead> = {}): Lead {
  return {
    id: UUID_LEAD,
    organizationId: '11111111-1111-4111-8111-111111111111',
    identityId: UUID_IDENTIDAD,
    contactName: 'Ana Pérez',
    status: 'NEW',
    source: 'paid',
    channel: 'META_LEAD_FORM',
    score: null,
    ownerUserId: null,
    firstResponseAt: null,
    convertedAt: null,
    closedVia: null,
    consent: {
      granted: true,
      basis: 'META_CUSTOM_DISCLAIMER',
      textVersion: '2026-01',
      capturedAt: '2026-10-01T12:00:00.000Z',
    },
    createdAt: '2026-10-01T12:00:00.000Z',
    identity: { id: UUID_IDENTIDAD, email: 'ana@ejemplo.test', phone: '+573000000000' },
    ...cambios,
  };
}

function conLeads(leads: readonly Lead[], hasMore = false): LeadsResult {
  return {
    outcome: 'ok',
    httpStatus: 200,
    traceId: TRACE,
    leads,
    hasMore,
    problem: null,
    transportError: null,
  };
}

/** El caso de hoy: la ruta no está montada. */
function sinImplementar(): LeadsResult {
  return {
    outcome: 'problem',
    httpStatus: 404,
    traceId: TRACE,
    leads: [],
    hasMore: false,
    problem: buildProblem({
      code: 'RESOURCE_NOT_FOUND',
      detail: 'La ruta solicitada no existe.',
      instance: '/api/v1/leads',
      traceId: TRACE,
    }),
    transportError: null,
  };
}

async function render(result: LeadsResult): Promise<HTMLElement> {
  // Permite llamar a `render()` más de una vez dentro del mismo test.
  TestBed.resetTestingModule();

  TestBed.configureTestingModule({
    imports: [Leads],
    providers: [{ provide: LeadsApi, useValue: new FakeLeadsApi(result) }],
  });

  const fixture: ComponentFixture<Leads> = TestBed.createComponent(Leads);
  await fixture.whenStable();

  // `refresh()` se lanza en el constructor y resuelve por microtareas, que `whenStable()` no sigue.
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();

  return fixture.nativeElement as HTMLElement;
}

function filas(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>('table.table tbody tr')];
}

describe('Leads — no se inventan datos', () => {
  it('explica que el endpoint no existe todavía, en vez de mostrar filas de ejemplo', async () => {
    const el = await render(sinImplementar());

    const aviso = el.querySelector('.note--warn');
    expect(aviso).not.toBeNull();
    expect(aviso?.textContent).toContain('RESOURCE_NOT_FOUND');
    expect(aviso?.textContent).toContain('Hito 2');
    // Ni una sola fila: la tabla no se pinta vacía, no se pinta.
    expect(el.querySelector('table')).toBeNull();
  });

  it('distingue «el listado no existe» de «el listado está vacío»', async () => {
    const vacio = await render(conLeads([]));

    expect(vacio.querySelector('.note--warn')).toBeNull();
    expect(vacio.querySelector('.note--info')?.textContent).toContain('todavía no hay ningún lead');
    expect(vacio.querySelector('table')).toBeNull();
  });

  it('avisa cuando el API no responde, y no lo confunde con un error del contrato', async () => {
    const el = await render({
      outcome: 'unreachable',
      httpStatus: null,
      traceId: null,
      leads: [],
      hasMore: false,
      problem: null,
      transportError: 'No hubo respuesta del API. ¿Está arrancado en el puerto 3000?',
    });

    expect(el.querySelector('.alert--bad')?.textContent).toContain('puerto 3000');
    expect(el.querySelector('.problem')).toBeNull();
    expect(el.querySelector('table')).toBeNull();
  });

  it('declara en pantalla de dónde salen los datos', async () => {
    const el = await render(conLeads([lead()]));

    const origen = el.querySelector('.origin')?.textContent ?? '';
    expect(origen).toContain('Real');
    // Y lo que el enlace NO puede afirmar: que el mensaje se envió.
    expect(origen).toContain('No confirma que el mensaje se envió');
  });
});

describe('Leads — la tabla', () => {
  it('pinta los datos del lead tal como llegan', async () => {
    const el = await render(conLeads([lead()]));

    const fila = filas(el)[0];
    expect(fila?.textContent).toContain('Ana Pérez');
    expect(fila?.textContent).toContain('ana@ejemplo.test');
    expect(fila?.textContent).toContain('+573000000000');
    expect(fila?.textContent).toContain('Nuevo');
    expect(fila?.textContent).toContain('Formulario de Meta');
    // El estado se comunica con texto, no solo con color.
    expect(fila?.querySelector('.status')?.textContent).toContain('Nuevo');
  });

  it('marca «Sin responder» cuando no hay primera respuesta', async () => {
    // `firstResponseAt` es la métrica clave del embudo: si la pantalla no la distingue de una fecha
    // real, deja de servir para lo único que se pidió.
    const el = await render(conLeads([lead({ firstResponseAt: null })]));

    expect(filas(el)[0]?.textContent).toContain('Sin responder');
  });

  it('muestra la fecha cuando sí hubo primera respuesta', async () => {
    const el = await render(conLeads([lead({ firstResponseAt: '2026-10-01T15:30:00.000Z' })]));

    const fila = filas(el)[0];
    expect(fila?.textContent).not.toContain('Sin responder');
    expect(fila?.querySelector('time[datetime="2026-10-01T15:30:00.000Z"]')).not.toBeNull();
  });

  it('avisa de que hay más leads, para no dar a entender que esa es la lista entera', async () => {
    const el = await render(conLeads([lead()], true));

    expect(el.querySelector('.note--info')?.textContent).toContain('hay más');
  });
});

describe('Leads — consentimiento', () => {
  it('marca visiblemente un consentimiento NO otorgado', async () => {
    const el = await render(
      conLeads([lead({ consent: { granted: false, basis: 'NO_DISCLAIMER_IN_FORM', textVersion: '2026-01', capturedAt: null } })]),
    );

    const fila = filas(el)[0];
    expect(fila?.textContent).toContain('NO autorizado');
    expect(fila?.textContent).toContain('Marketing bloqueado');
    expect(fila?.querySelector('.status--bad')).not.toBeNull();
  });

  it('trata «sin constancia» como marketing bloqueado, no como permiso', async () => {
    // `docs/security.md` §10.7: la ausencia de evidencia no es evidencia de permiso. Es distinto de
    // un «no» explícito, y por eso se dice «Sin registro» y no «NO autorizado».
    const el = await render(conLeads([lead({ consent: null })]));

    const fila = filas(el)[0];
    expect(fila?.textContent).toContain('Sin registro');
    expect(fila?.textContent).toContain('Marketing bloqueado');
    expect(fila?.textContent).not.toContain('Autorizado');
  });
});

describe('Leads — el enlace a WhatsApp', () => {
  it('construye el enlace con el número en dígitos y el mensaje codificado', async () => {
    const el = await render(conLeads([lead()]));

    const enlace = filas(el)[0]?.querySelector<HTMLAnchorElement>('a.lead__wa');
    expect(enlace?.getAttribute('href')).toContain('https://wa.me/573000000000?text=');
    expect(enlace?.getAttribute('target')).toBe('_blank');
    // `noopener` es obligatorio con `target="_blank"`: sin él, la página abierta puede manipular
    // esta pestaña a través de `window.opener`.
    expect(enlace?.getAttribute('rel')).toContain('noopener');
  });

  it('no mete más datos personales que el nombre de pila en la URL', async () => {
    // El texto del mensaje viaja en la URL y queda en el historial del navegador.
    const el = await render(conLeads([lead()]));

    const href = filas(el)[0]?.querySelector('a.lead__wa')?.getAttribute('href') ?? '';
    expect(href).toContain('Ana');
    expect(href).not.toContain('Pérez');
    expect(href).not.toContain('ana@ejemplo.test');
    expect(href).not.toContain('573000000000%3F');
  });

  it('no ofrece enlace cuando el lead no trae teléfono, y explica por qué', async () => {
    const el = await render(
      conLeads([lead({ identity: { id: UUID_IDENTIDAD, email: 'ana@ejemplo.test', phone: null } })]),
    );

    const fila = filas(el)[0];
    expect(fila?.querySelector('a.lead__wa')).toBeNull();
    expect(fila?.textContent).toContain('Sin teléfono');
    expect(fila?.textContent).toContain('Meta no lo pidió');
  });

  it('no ofrece enlace con un teléfono que no está en E.164', async () => {
    // Un número sin código de país no falla en wa.me: escribe a otra persona.
    const el = await render(
      conLeads([lead({ identity: { id: UUID_IDENTIDAD, email: null, phone: '3001234567' } })]),
    );

    expect(filas(el)[0]?.querySelector('a.lead__wa')).toBeNull();
  });

  it('saluda sin nombre cuando el lead no lo trae', async () => {
    const el = await render(conLeads([lead({ contactName: null })]));

    const fila = filas(el)[0];
    expect(fila?.textContent).toContain('Sin nombre');
    expect(fila?.querySelector('a.lead__wa')?.getAttribute('href')).toContain('Hola%2C%20gracias');
  });
});
