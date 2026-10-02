import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import type { Lead } from '@crm/contracts';

import { LeadsApi, type LeadsResult } from '../../core/leads-api';
import { Sales } from './sales';

class FakeLeadsApi {
  constructor(private readonly result: LeadsResult) {}

  list(): Promise<LeadsResult> {
    return Promise.resolve(this.result);
  }
}

const lead = (cambios: Partial<Lead> = {}): Lead => ({
  id: 'lead-1',
  organizationId: 'org-1',
  identityId: 'id-1',
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
  identity: { id: 'id-1', email: 'ana@ejemplo.test', phone: '+573000000000' },
  ...cambios,
});

const conLeads = (leads: readonly Lead[], hasMore = false): LeadsResult => ({
  outcome: 'ok',
  httpStatus: 200,
  traceId: 'trace-1',
  leads,
  hasMore,
  problem: null,
  transportError: null,
});

async function render(result: LeadsResult): Promise<ComponentFixture<Sales>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Sales],
    providers: [
      provideRouter([]),
      { provide: LeadsApi, useValue: new FakeLeadsApi(result) },
    ],
  });

  const fixture = TestBed.createComponent(Sales);
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();

  return fixture;
}

describe('Sales', () => {
  it('muestra el título y la acción principal', async () => {
    const fixture = await render(conLeads([]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Ventas');
    expect(el.textContent).toContain('Nuevo deal');
  });

  it('renderiza el pipeline comercial', async () => {
    const fixture = await render(conLeads([]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Nuevo');
    expect(el.textContent).toContain('Contactado');
    expect(el.textContent).toContain('Cualificado');
    expect(el.textContent).toContain('Propuesta');
    expect(el.textContent).toContain('Cerrado');
  });

  it('muestra métricas reales de leads y datos demo', async () => {
    const fixture = await render(conLeads([lead(), lead({ id: 'lead-2', firstResponseAt: '2026-10-01T15:00:00.000Z' })]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Leads activos');
    expect(el.textContent).toContain('2');
    expect(el.textContent).toContain('Tasa de respuesta');
    expect(el.textContent).toContain('50%');
    expect(el.textContent).toContain('Valor pipeline');
    expect(el.textContent).toContain('Clientes activos');
  });

  it('muestra leads recientes con acciones', async () => {
    const fixture = await render(conLeads([lead()]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Leads recientes');
    expect(el.textContent).toContain('Real');
    expect(el.textContent).toContain('Ana Pérez');
    expect(el.textContent).toContain('Contactar');
    expect(el.textContent).toContain('Cualificar');
    expect(el.textContent).toContain('Convertir');
    expect(el.textContent).toContain('Archivar');
  });

  it('muestra oportunidades, clientes y seguimientos de demo', async () => {
    const fixture = await render(conLeads([]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Oportunidades');
    expect(el.textContent).toContain('Distribuidora Norte');
    expect(el.textContent).toContain('Clientes');
    expect(el.textContent).toContain('Carlos Ruiz');
    expect(el.textContent).toContain('Seguimientos');
    expect(el.textContent).toContain('Llamar para confirmar interés');
  });

  it('muestra empty state para órdenes', async () => {
    const fixture = await render(conLeads([]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Órdenes y pedidos');
    expect(el.textContent).toContain('Sin órdenes registradas');
  });

  it('declara el origen de los datos con badges Real y Demo', async () => {
    const fixture = await render(conLeads([]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('De dónde salen estos datos');
    expect(el.textContent).toContain('FRONTEND DATA GAP');
    expect(el.textContent).toContain('Real');
    expect(el.textContent).toContain('Demo');
  });

  it('registra FRONTEND DATA GAP al pulsar Nuevo deal', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fixture = await render(conLeads([]));
    const el = fixture.nativeElement as HTMLElement;

    const button = el.querySelector('header app-button button');
    expect(button).toBeTruthy();
    (button as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(consoleSpy).toHaveBeenLastCalledWith(
      'FRONTEND DATA GAP: no backend endpoint to create a deal',
    );

    consoleSpy.mockRestore();
  });
});
