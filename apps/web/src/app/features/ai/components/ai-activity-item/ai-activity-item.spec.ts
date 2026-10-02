import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  AiActivityItemComponent,
  type AiActivity,
} from './ai-activity-item';

const activity: AiActivity = {
  id: 'act-1',
  agentName: 'GrowthBot',
  type: 'insight',
  summary: 'Detecté un segmento de alto interés',
  detail: 'Los leads de Instagram responden 2.4x más que el promedio.',
  createdAt: '2026-10-02T14:30:00.000Z',
};

async function render(
  value: AiActivity = activity,
): Promise<ComponentFixture<AiActivityItemComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [AiActivityItemComponent] });

  const fixture = TestBed.createComponent(AiActivityItemComponent);
  fixture.componentRef.setInput('activity', value);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('AiActivityItemComponent', () => {
  it('muestra resumen, agente y fecha', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Detecté un segmento de alto interés');
    expect(text).toContain('GrowthBot');
    expect(text).toContain('02/10');
  });

  it('muestra detalle y tipo', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Los leads de Instagram responden 2.4x más que el promedio.');
    expect(text).toContain('Insight');
  });
});
