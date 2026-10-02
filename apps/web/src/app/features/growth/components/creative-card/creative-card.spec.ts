import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  CreativeCardComponent,
  type Creative,
} from './creative-card';

const creative: Creative = {
  id: 'cr-1',
  name: 'Hero Verano',
  format: 'video',
  campaignName: 'Verano 2025',
  impressions: 45_230,
  ctr: 0.041,
};

async function render(
  value: Creative = creative,
): Promise<ComponentFixture<CreativeCardComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [CreativeCardComponent] });

  const fixture = TestBed.createComponent(CreativeCardComponent);
  fixture.componentRef.setInput('creative', value);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('CreativeCardComponent', () => {
  it('muestra nombre, formato y campaña', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Hero Verano');
    expect(text).toContain('Vídeo');
    expect(text).toContain('Verano 2025');
  });

  it('muestra impresiones formateadas y CTR', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('45.230');
    expect(text).toContain('4.1%');
  });
});
