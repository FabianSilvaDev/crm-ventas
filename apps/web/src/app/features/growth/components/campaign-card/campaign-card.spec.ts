import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  CampaignCardComponent,
  type Campaign,
} from './campaign-card';

const campaign: Campaign = {
  id: 'c-1',
  name: 'Verano 2025',
  status: 'active',
  channel: 'Meta Ads',
  budget: 5000,
  spend: 2100,
  leads: 124,
  ctr: 0.034,
  roas: 2.4,
  daysLeft: 18,
};

async function render(
  value: Campaign = campaign,
): Promise<ComponentFixture<CampaignCardComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [CampaignCardComponent] });

  const fixture = TestBed.createComponent(CampaignCardComponent);
  fixture.componentRef.setInput('campaign', value);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('CampaignCardComponent', () => {
  it('muestra nombre, canal y días restantes', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Verano 2025');
    expect(text).toContain('Meta Ads');
    expect(text).toContain('18 días restantes');
  });

  it('renderiza el estado y la insignia Demo', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Activa');
    expect(text).toContain('Demo');
  });

  it('muestra métricas clave', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('$5,000');
    expect(text).toContain('$2,100');
    expect(text).toContain('124');
    expect(text).toContain('3.4%');
    expect(text).toContain('2.4x');
  });

  it('calcula el porcentaje de gasto', async () => {
    const fixture = await render();
    const fill = fixture.nativeElement.querySelector('.progress-bar__fill');

    expect(fill).toBeTruthy();
    expect(fill.style.width).toBe('42%');
    expect(fixture.nativeElement.textContent).toContain('42%');
  });

  it('emite la campaña al pulsar Gestionar', async () => {
    const fixture = await render();
    const emitted: Campaign[] = [];
    fixture.componentInstance.action.subscribe((c) => emitted.push(c));

    const button = fixture.nativeElement.querySelector('app-button button');
    expect(button).toBeTruthy();
    (button as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(emitted.at(-1)).toBe(campaign);
  });
});
