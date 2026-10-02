import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ProductScoreComponent } from './product-score';

async function render(score: number): Promise<ComponentFixture<ProductScoreComponent>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [ProductScoreComponent] });

  const fixture = TestBed.createComponent(ProductScoreComponent);
  fixture.componentRef.setInput('score', score);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('ProductScore', () => {
  it('muestra el valor como número con texto accesible', async () => {
    const fixture = await render(87);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.score__value')?.textContent?.trim()).toBe('87');
    expect(el.querySelector('.score')?.getAttribute('aria-label')).toContain('87 de 100');
  });

  it('clasifica >= 80 como Alta y pinta la barra de éxito', async () => {
    const fixture = await render(87);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Alta');
    expect(el.querySelector('.score--high')).not.toBeNull();
  });

  it('clasifica 50–79 como Media y pinta la barra de advertencia', async () => {
    const fixture = await render(72);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Media');
    expect(el.querySelector('.score--medium')).not.toBeNull();
  });

  it('clasifica < 50 como Baja y pinta la barra de peligro', async () => {
    const fixture = await render(42);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Baja');
    expect(el.querySelector('.score--low')).not.toBeNull();
  });

  it('restringe el valor entre 0 y 100', async () => {
    const fixture = await render(150);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.score__value')?.textContent?.trim()).toBe('100');
    expect(el.querySelector('.score__fill')?.getAttribute('style')).toContain('width: 100%');
  });
});
