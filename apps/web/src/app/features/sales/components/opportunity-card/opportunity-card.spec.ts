import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  OpportunityCardComponent,
  type Opportunity,
} from './opportunity-card';

const opportunity: Opportunity = {
  id: 'op-1',
  name: 'Distribuidora Norte',
  company: 'Distribuidora Norte S.A.',
  value: 45_000,
  stage: 'proposal',
  probability: 60,
  expectedClose: '15/11',
  nextAction: 'Enviar propuesta formal',
};

async function render(
  value: Opportunity = opportunity,
): Promise<ComponentFixture<OpportunityCardComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [OpportunityCardComponent] });

  const fixture = TestBed.createComponent(OpportunityCardComponent);
  fixture.componentRef.setInput('opportunity', value);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('OpportunityCardComponent', () => {
  it('muestra nombre, empresa y etapa', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Distribuidora Norte');
    expect(text).toContain('Distribuidora Norte S.A.');
    expect(text).toContain('Propuesta');
  });

  it('muestra valor, probabilidad y cierre esperado', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('$45,000');
    expect(text).toContain('60%');
    expect(text).toContain('15/11');
  });

  it('muestra la próxima acción', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Enviar propuesta formal');
  });

  it('emite la oportunidad al pulsar Ver deal', async () => {
    const fixture = await render();
    const emitted: Opportunity[] = [];
    fixture.componentInstance.action.subscribe((o) => emitted.push(o));

    const button = fixture.nativeElement.querySelector('app-button button');
    expect(button).toBeTruthy();
    (button as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(emitted.at(-1)).toBe(opportunity);
  });
});
