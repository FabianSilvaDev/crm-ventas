import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  AiRecommendationCardComponent,
  type AiRecommendation,
} from './ai-recommendation-card';

const recommendation: AiRecommendation = {
  id: 'rec-1',
  title: 'Aumentar presupuesto',
  what: 'La campaña de verano tiene CPA mejorado.',
  why: ['CTR subió 31%', 'CPA bajó 18%'],
  confidence: 82,
  impact: 'Más conversiones con mismo ROAS',
  actionLabel: 'Revisar campaña',
  source: 'Agente de Growth',
};

async function render(
  value: AiRecommendation = recommendation,
): Promise<ComponentFixture<AiRecommendationCardComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [AiRecommendationCardComponent] });

  const fixture = TestBed.createComponent(AiRecommendationCardComponent);
  fixture.componentRef.setInput('recommendation', value);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('AiRecommendationCardComponent', () => {
  it('muestra título, fuente y qué recomienda', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Aumentar presupuesto');
    expect(text).toContain('Agente de Growth');
    expect(text).toContain('La campaña de verano tiene CPA mejorado.');
  });

  it('lista los motivos', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('CTR subió 31%');
    expect(text).toContain('CPA bajó 18%');
  });

  it('muestra confianza e impacto', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('82%');
    expect(text).toContain('Más conversiones con mismo ROAS');
  });

  it('emite la recomendación al pulsar la acción', async () => {
    const fixture = await render();
    const emitted: AiRecommendation[] = [];
    fixture.componentInstance.action.subscribe((r) => emitted.push(r));

    const button = fixture.nativeElement.querySelector('app-button button');
    expect(button).toBeTruthy();
    (button as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(emitted.at(-1)).toBe(recommendation);
  });
});
