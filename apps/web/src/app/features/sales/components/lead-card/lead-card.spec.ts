import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { Lead } from '@crm/contracts';

import {
  LeadCardComponent,
  type LeadAction,
} from './lead-card';

const lead: Lead = {
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
  identity: {
    id: 'id-1',
    email: 'ana@ejemplo.test',
    phone: '+573000000000',
  },
};

async function render(
  value: Lead = lead,
): Promise<ComponentFixture<LeadCardComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [LeadCardComponent] });

  const fixture = TestBed.createComponent(LeadCardComponent);
  fixture.componentRef.setInput('lead', value);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('LeadCardComponent', () => {
  it('muestra nombre, iniciales, canal y fecha', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Ana Pérez');
    expect(text).toContain('AP');
    expect(text).toContain('Meta Lead Form');
    expect(text).toContain('01/10');
  });

  it('muestra el estado con color y texto', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Nuevo');
    expect(fixture.nativeElement.querySelector('.badge--info')).not.toBeNull();
  });

  it('emite la acción al pulsar Contactar', async () => {
    const fixture = await render();
    const emitted: Array<{ leadId: string; action: LeadAction }> = [];
    fixture.componentInstance.action.subscribe((a) => emitted.push(a));

    const buttons = fixture.nativeElement.querySelectorAll('app-button button');
    const contact = [...buttons].find((b) => b.textContent?.trim() === 'Contactar');
    expect(contact).toBeTruthy();
    (contact as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(emitted.at(-1)).toEqual({ leadId: 'lead-1', action: 'contact' });
  });

  it('usa fallback para nombre ausente', async () => {
    const fixture = await render({ ...lead, contactName: null });
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Sin nombre');
  });
});
