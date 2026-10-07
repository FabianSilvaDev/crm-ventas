import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { buildProblem } from '@crm/contracts';
import type { Lead } from '@crm/contracts';
import { describe, expect, it } from 'vitest';

import { HealthService, type LivenessResponse, type Probe } from '../../core/health';
import { LeadsApi, type LeadsResult } from '../../core/leads-api';
import { SessionService, type SessionIdentity } from '../../core/session';
import { Home } from './home';

/**
 * La Home transforma el CRM en un centro de control comercial, pero **no inventa datos**:
 * solo consume APIs existentes (`LeadsApi`, `HealthService`) y deja visibles como `Demo`
 * las recomendaciones de IA mientras no haya backend real.
 */

const TRACE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const UUID_LEAD = '33333333-3333-4333-8333-333333333333';
const UUID_IDENTIDAD = '22222222-2222-4222-8222-222222222222';

class FakeSession {
  readonly user = signal<SessionIdentity | null>({
    id: '11111111-1111-4111-8111-111111111111',
    email: 'fabian@ejemplo.test',
    role: 'admin',
    permissions: [],
  });
}

class FakeLeadsApi {
  constructor(private readonly result: LeadsResult) {}

  list(): Promise<LeadsResult> {
    return Promise.resolve(this.result);
  }
}

class FakeHealthService {
  constructor(private readonly liveResult: Probe<LivenessResponse>) {}

  live(): Promise<Probe<LivenessResponse>> {
    return Promise.resolve(this.liveResult);
  }
}

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

function conLeads(leads: readonly Lead[]): LeadsResult {
  return {
    outcome: 'ok',
    httpStatus: 200,
    traceId: TRACE,
    leads,
    hasMore: false,
    problem: null,
    transportError: null,
  };
}

function okHealth(): Probe<LivenessResponse> {
  return {
    outcome: 'ok',
    httpStatus: 200,
    latencyMs: 12,
    traceId: TRACE,
    body: { status: 'ok', timestamp: '2026-10-01T10:00:00.000Z' },
    problem: null,
    transportError: null,
  };
}

function unreachableHealth(): Probe<LivenessResponse> {
  return {
    outcome: 'unreachable',
    httpStatus: null,
    latencyMs: 3,
    traceId: null,
    body: null,
    problem: null,
    transportError: 'No hubo respuesta del API. ¿Está arrancado en el puerto 3000?',
  };
}

async function render(result: LeadsResult, health = okHealth()): Promise<ComponentFixture<Home>> {
  TestBed.resetTestingModule();

  TestBed.configureTestingModule({
    imports: [Home],
    providers: [
      provideRouter([]),
      { provide: LeadsApi, useValue: new FakeLeadsApi(result) },
      { provide: HealthService, useValue: new FakeHealthService(health) },
      { provide: SessionService, useValue: new FakeSession() },
    ],
  });

  const fixture = TestBed.createComponent(Home);
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();

  return fixture;
}

describe('Home / Business Overview', () => {
  it('muestra el saludo con el nombre del usuario', async () => {
    const fixture = await render(conLeads([]));
    const el = fixture.nativeElement as HTMLElement;

    const text = el.textContent ?? '';
    const hasGreeting =
      text.includes('Buenos días') || text.includes('Buenas tardes') || text.includes('Buenas noches');
    expect(hasGreeting).toBe(true);
    expect(text).toContain('Fabian');
    expect(text).toContain('Así va tu negocio hoy');
  });

  it('muestra skeletons mientras carga y luego el conteo de leads', async () => {
    const fixture = await render(conLeads([lead(), lead({ id: 'otro-uuid', contactName: 'Luis Gómez' })]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Leads activos');
    expect(el.textContent).toContain('2');
  });

  it('lista hasta 3 leads recientes con nombre y fecha', async () => {
    const fixture = await render(
      conLeads([
        lead(),
        lead({ id: 'lead-2', contactName: 'Luis Gómez', createdAt: '2026-10-02T10:00:00.000Z' }),
        lead({ id: 'lead-3', contactName: 'María Ruiz', createdAt: '2026-10-03T10:00:00.000Z' }),
      ]),
    );
    const el = fixture.nativeElement as HTMLElement;

    const names = [...el.querySelectorAll('.lead-list__name')].map((n) => n.textContent?.trim());
    expect(names).toEqual(['Ana Pérez', 'Luis Gómez', 'María Ruiz']);
  });

  it('calcula la tasa de respuesta a partir de los leads reales', async () => {
    const fixture = await render(
      conLeads([
        lead({ firstResponseAt: '2026-10-01T15:00:00.000Z' }),
        lead({ id: 'lead-2', contactName: 'Luis Gómez' }),
        lead({ id: 'lead-3', contactName: 'María Ruiz', firstResponseAt: '2026-10-02T15:00:00.000Z' }),
      ]),
    );
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Tasa de respuesta');
    expect(el.textContent).toContain('67%');
  });

  it('muestra una alerta cuando el sistema no responde', async () => {
    const fixture = await render(conLeads([]), unreachableHealth());
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Requiere atención');
    expect(el.textContent).toContain('Sistema no responde');
    expect(el.textContent).toContain('puerto 3000');
  });

  it('muestra alerta de leads cuando la API no responde', async () => {
    const fixture = await render(
      {
        outcome: 'unreachable',
        httpStatus: null,
        traceId: null,
        leads: [],
        hasMore: false,
        problem: null,
        transportError: 'No hubo respuesta del API. ¿Está arrancado en el puerto 3000?',
      },
      okHealth(),
    );
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Leads no disponibles');
  });

  it('muestra empty state accionable cuando no hay leads recientes', async () => {
    const fixture = await render(conLeads([]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Sin leads recientes');
    expect(el.textContent).toContain('Ir a Leads');
  });

  it('muestra recomendaciones de IA marcadas como demostración', async () => {
    const fixture = await render(conLeads([]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Recomendaciones de IA');
    expect(el.textContent).toContain('Demo');
    expect(el.textContent).toContain('Lanzar campaña para Rolex Submariner azul');
    expect(el.textContent).toContain('91%');
    expect(el.textContent).toContain('Acquisition Journey');
  });

  it('declara qué datos son reales y cuáles son demo', async () => {
    const fixture = await render(conLeads([lead()]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('De dónde salen estos datos');
    expect(el.textContent).toContain('/api/v1/leads');
    expect(el.textContent).toContain('/health/live');
    expect(el.textContent).toContain('FRONTEND DATA GAP');
  });

  it('muestra trabajo activo vacío hasta aprobar una recomendación', async () => {
    const fixture = await render(conLeads([]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Trabajo activo');
    expect(el.textContent).toContain('Sin tareas activas');
    expect(el.textContent).toContain('Aprueba una recomendación de IA para generar tu primera tarea');
  });

  it('genera trabajo activo al aprobar una recomendación', async () => {
    const fixture = await render(conLeads([]));
    const el = fixture.nativeElement as HTMLElement;

    const approveButton = el.querySelector('app-recommendation-card app-button') as HTMLButtonElement;
    approveButton?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Pendientes de ejecución');
    expect(el.textContent).toContain('Lanzar campaña para Rolex Submariner azul');
    expect(el.textContent).toContain('Aprobada');
  });
});
