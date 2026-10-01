import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { buildProblem } from '@crm/contracts';
import type { ProblemDetails } from '@crm/contracts';

import { HealthService } from '../../core/health';
import type { LivenessResponse, Probe, ReadinessResponse } from '../../core/health';
import { SystemStatus } from './system-status';

/**
 * La regla de negocio de esta pantalla no es "pinta el JSON": es **no afirmar más de lo que
 * se comprobó**. Por eso los tests giran alrededor de `checks: []` — el caso en el que el API
 * responde `ok` sin haber verificado nada.
 */

class FakeHealthService {
  constructor(
    readonly liveResult: Probe<LivenessResponse>,
    readonly readyResult: Probe<ReadinessResponse>,
  ) {}

  live(): Promise<Probe<LivenessResponse>> {
    return Promise.resolve(this.liveResult);
  }

  ready(): Promise<Probe<ReadinessResponse>> {
    return Promise.resolve(this.readyResult);
  }
}

const TRACE_ID = 'f3a91c0d47b28e6515aa9d3c7e0b4128';

function okProbe<T>(body: T, latencyMs = 12): Probe<T> {
  return {
    outcome: 'ok',
    httpStatus: 200,
    latencyMs,
    traceId: TRACE_ID,
    body,
    problem: null,
    transportError: null,
  };
}

function unreachableProbe<T>(): Probe<T> {
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

function problemProbe<T>(problem: ProblemDetails): Probe<T> {
  return {
    outcome: 'problem',
    httpStatus: problem.status,
    latencyMs: 8,
    traceId: problem.traceId,
    body: null,
    problem,
    transportError: null,
  };
}

function readiness(
  checks: ReadinessResponse['checks'],
  status: ReadinessResponse['status'] = 'ok',
): ReadinessResponse {
  return { status, timestamp: '2026-10-01T10:00:00.000Z', checks };
}

async function render(
  liveResult: Probe<LivenessResponse>,
  readyResult: Probe<ReadinessResponse>,
): Promise<ComponentFixture<SystemStatus>> {
  // Permite llamar a `render()` más de una vez dentro del mismo test (comparar dos
  // escenarios): sin esto, el segundo `configureTestingModule` choca con el módulo ya
  // instanciado por el primero.
  TestBed.resetTestingModule();

  TestBed.configureTestingModule({
    imports: [SystemStatus],
    providers: [{ provide: HealthService, useValue: new FakeHealthService(liveResult, readyResult) }],
  });

  const fixture = TestBed.createComponent(SystemStatus);
  await fixture.whenStable();

  // `refresh()` se lanza en el constructor y resuelve por microtareas, que `whenStable()` no
  // sigue. Un macrotask drena la cola entera de forma determinista, sin contar ticks a mano.
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();

  return fixture;
}

describe('SystemStatus', () => {
  it('no presenta como verificado un readiness sin dependencias comprobadas', async () => {
    const fixture = await render(
      okProbe<LivenessResponse>({ status: 'ok', timestamp: '2026-10-01T10:00:00.000Z' }),
      okProbe(readiness([])),
    );
    const el = fixture.nativeElement as HTMLElement;

    // El estado global sigue siendo verde: el proceso responde de verdad.
    expect(el.querySelector('.card:nth-of-type(2) .status')?.textContent).toContain('Listo');

    // Pero se dice explícitamente que ese verde no está respaldado por nada.
    const warning = el.querySelector('.note--warn');
    expect(warning).not.toBeNull();
    expect(warning?.textContent).toContain('no está respaldado');
    expect(el.querySelector('table.table')).toBeNull();
  });

  it('lista las dependencias cuando el API sí las comprueba', async () => {
    const fixture = await render(
      okProbe<LivenessResponse>({ status: 'ok', timestamp: '2026-10-01T10:00:00.000Z' }),
      okProbe(
        readiness([
          { name: 'postgres', status: 'up', durationMs: 4 },
          { name: 'redis', status: 'down', durationMs: 30 },
        ]),
      ),
    );
    const el = fixture.nativeElement as HTMLElement;

    const rows = [...el.querySelectorAll('table.table tbody tr')];
    expect(rows.map((row) => row.querySelector('th')?.textContent?.trim())).toEqual([
      'postgres',
      'redis',
    ]);
    expect(el.querySelector('.note--warn')).toBeNull();

    // Un estado 'down' se comunica con texto, no sólo con color.
    expect(rows[1]?.querySelector('.status')?.textContent).toContain('Caída');
  });

  it('informa "No listo" cuando el API se declara no_ready', async () => {
    const fixture = await render(
      okProbe<LivenessResponse>({ status: 'ok', timestamp: '2026-10-01T10:00:00.000Z' }),
      okProbe(readiness([{ name: 'postgres', status: 'down', durationMs: 5000 }], 'not_ready')),
    );
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.card:nth-of-type(2) .status--warn')?.textContent).toContain('No listo');
  });

  it('distingue "el API no responde" de "el API devolvió un error"', async () => {
    const unreachable = await render(
      okProbe<LivenessResponse>({ status: 'ok', timestamp: '2026-10-01T10:00:00.000Z' }),
      unreachableProbe<ReadinessResponse>(),
    );
    expect((unreachable.nativeElement as HTMLElement).querySelector('.alert--bad')?.textContent)
      .toContain('puerto 3000');
    expect((unreachable.nativeElement as HTMLElement).querySelector('.problem')).toBeNull();

    const withProblem = await render(
      okProbe<LivenessResponse>({ status: 'ok', timestamp: '2026-10-01T10:00:00.000Z' }),
      problemProbe<ReadinessResponse>(
        // Se construye con el catálogo de `@crm/contracts`, no con un literal a mano: si el
        // contrato gana un campo obligatorio, este test deja de compilar en vez de divergir.
        buildProblem({
          code: 'DEPENDENCY_UNAVAILABLE',
          detail: 'Postgres no respondió a la sonda en 5000 ms.',
          instance: '/health/ready',
          traceId: TRACE_ID,
        }),
      ),
    );
    const problemEl = (withProblem.nativeElement as HTMLElement).querySelector('.problem');
    expect(problemEl?.textContent).toContain('Dependencia no disponible');
    expect(problemEl?.textContent).toContain('DEPENDENCY_UNAVAILABLE');
    expect(problemEl?.textContent).toContain('503');
    // El traceId del error es lo que permite cruzar la pantalla con los logs del API.
    expect(problemEl?.textContent).toContain(TRACE_ID);
  });

  it('muestra el traceId devuelto por el API en la cabecera', async () => {
    const fixture = await render(
      okProbe<LivenessResponse>({ status: 'ok', timestamp: '2026-10-01T10:00:00.000Z' }, 42),
      okProbe(readiness([])),
    );
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.card:nth-of-type(1) code.mono')?.textContent).toBe(TRACE_ID);
    expect(el.querySelector('.card:nth-of-type(1) .kv')?.textContent).toContain('42 ms');
  });

  it('declara en pantalla que todo lo mostrado es dato real', async () => {
    const fixture = await render(
      okProbe<LivenessResponse>({ status: 'ok', timestamp: '2026-10-01T10:00:00.000Z' }),
      okProbe(readiness([])),
    );
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.origin')?.textContent).toContain('Real');
  });
});
