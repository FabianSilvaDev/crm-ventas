import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import {
  ProductOpportunityCardComponent,
  type ProductOpportunity,
} from './product-opportunity-card';

const OPPORTUNITY: ProductOpportunity = {
  id: 'p-1',
  name: 'Auriculares inalámbricos premium',
  score: 87,
  demand: 'high',
  competition: 'medium',
  margin: 32,
  trend: 'up',
  trendValue: '↑ 24%',
  aiInsight: 'La demanda crece mientras la competencia se mantiene moderada.',
  actions: [
    { id: 'analyze', label: 'Analizar', primary: true },
    { id: 'campaign', label: 'Crear campaña', primary: false },
  ],
};

async function render(): Promise<{
  fixture: ComponentFixture<ProductOpportunityCardComponent>;
  emitted: string[];
}> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [ProductOpportunityCardComponent],
    providers: [provideRouter([])],
  });

  const fixture = TestBed.createComponent(ProductOpportunityCardComponent);
  const emitted: string[] = [];

  fixture.componentRef.setInput('opportunity', OPPORTUNITY);
  fixture.componentInstance.action.subscribe((id) => emitted.push(id));

  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, emitted };
}

describe('ProductOpportunityCard', () => {
  it('muestra el nombre, categoría y puntuación', async () => {
    const { fixture } = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Auriculares inalámbricos premium');
    expect(el.textContent).toContain('Oportunidad de producto');
    expect(el.textContent).toContain('87');
    expect(el.textContent).toContain('Alta');
  });

  it('muestra demanda, competencia, margen y tendencia', async () => {
    const { fixture } = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Demanda');
    expect(el.textContent).toContain('Competencia');
    expect(el.textContent).toContain('Margen');
    expect(el.textContent).toContain('32%');
    expect(el.textContent).toContain('Tendencia');
    expect(el.textContent).toContain('↑ 24%');
  });

  it('muestra el insight de IA', async () => {
    const { fixture } = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Insight de IA');
    expect(el.textContent).toContain('La demanda crece mientras la competencia se mantiene moderada.');
  });

  it('emite el id de la acción al pulsar un botón', async () => {
    const { fixture, emitted } = await render();
    const el = fixture.nativeElement as HTMLElement;

    const buttons = el.querySelectorAll('app-button button');
    (buttons[0] as HTMLButtonElement)?.click();
    fixture.detectChanges();

    expect(emitted.at(-1)).toBe('analyze');
  });
});
