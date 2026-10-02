import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  AudienceListComponent,
  type Audience,
} from './audience-list';

const audiences: readonly Audience[] = [
  {
    id: 'a-1',
    name: 'Lookalike Compradores',
    size: 245_000,
    conversionRate: 0.028,
    channel: 'Meta Ads',
  },
  {
    id: 'a-2',
    name: 'Interés Tech',
    size: 89_000,
    conversionRate: 0.019,
    channel: 'TikTok',
  },
];

async function render(
  value: readonly Audience[] = audiences,
): Promise<ComponentFixture<AudienceListComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [AudienceListComponent] });

  const fixture = TestBed.createComponent(AudienceListComponent);
  fixture.componentRef.setInput('audiences', value);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('AudienceListComponent', () => {
  it('renderiza una entrada por audiencia', async () => {
    const fixture = await render();
    const items = fixture.nativeElement.querySelectorAll('.audience-list__item');

    expect(items.length).toBe(2);
  });

  it('muestra nombre, canal, tamaño y conversión', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Lookalike Compradores');
    expect(text).toContain('Meta Ads');
    expect(text).toContain('245.000');
    expect(text).toContain('2.8%');
  });
});
