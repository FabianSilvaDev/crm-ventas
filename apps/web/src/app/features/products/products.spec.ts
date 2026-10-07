import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { Products } from './products';

async function render(): Promise<ComponentFixture<Products>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Products],
    providers: [provideRouter([])],
  });

  const fixture = TestBed.createComponent(Products);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('Products', () => {
  it('muestra el título y el pipeline de inteligencia de producto', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Productos');
    expect(el.textContent).toContain('Descubrir');
    expect(el.textContent).toContain('Analizar');
    expect(el.textContent).toContain('Puntuar');
    expect(el.textContent).toContain('Seleccionar');
    expect(el.textContent).toContain('Vender');
  });

  it('muestra oportunidades de demostración con score y acciones', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Oportunidades destacadas');
    expect(el.textContent).toContain('Demo');
    expect(el.textContent).toContain('Reloj Rolex Submariner réplica azul');
    expect(el.textContent).toContain('91');
    expect(el.textContent).toContain('Auriculares inalámbricos premium');
    expect(el.textContent).toContain('Cargador solar portátil');
    expect(el.textContent).toContain('Insight de IA');
    expect(el.textContent).toContain('Crear campaña');
  });

  it('muestra empty states accionables para tendencias y competidores', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Tendencias de mercado');
    expect(el.textContent).toContain('Datos de tendencias no disponibles');
    expect(el.textContent).toContain('Competidores');
    expect(el.textContent).toContain('Sin análisis de competidores');
  });

  it('declara qué datos son demo y cuáles están pendientes', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('De dónde salen estos datos');
    expect(el.textContent).toContain('FRONTEND DATA GAP');
  });

  it('oculta una oportunidad al pulsar Ignorar', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Reloj Rolex Submariner réplica azul');

    const ignoreButtons = [...el.querySelectorAll('app-button button')].filter(
      (b) => b.textContent?.trim() === 'Ignorar',
    );
    expect(ignoreButtons.length).toBeGreaterThan(0);

    (ignoreButtons[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.textContent).not.toContain('Reloj Rolex Submariner réplica azul');
    expect(el.textContent).toContain('Auriculares inalámbricos premium');
    expect(el.textContent).toContain('Cargador solar portátil');
  });
});
