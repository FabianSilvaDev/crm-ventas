import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { Growth } from './growth';

async function render(): Promise<ComponentFixture<Growth>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Growth],
    providers: [provideRouter([])],
  });

  const fixture = TestBed.createComponent(Growth);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('Growth', () => {
  it('muestra el título y la acción principal', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Growth');
    expect(el.textContent).toContain('Nueva campaña');
  });

  it('renderiza el pipeline de crecimiento', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Atraer');
    expect(el.textContent).toContain('Enganchar');
    expect(el.textContent).toContain('Convertir');
    expect(el.textContent).toContain('Retener');
    expect(el.textContent).toContain('Optimizar');
  });

  it('muestra métricas de resumen etiquetadas como Demo', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Campañas activas');
    expect(el.textContent).toContain('ROAS promedio');
    expect(el.textContent).toContain('Demo');
  });

  it('lista las campañas, creativos, audiencias y experimentos de demostración', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Verano 2025');
    expect(el.textContent).toContain('Hero Verano');
    expect(el.textContent).toContain('Lookalike Compradores');
    expect(el.textContent).toContain('CTA primario');
  });

  it('muestra empty state accionable para SEO y contenido', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Sin oportunidades de contenido');
    expect(el.textContent).toContain('Ver research');
  });

  it('declara el origen de los datos con badge Demo', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('De dónde salen estos datos');
    expect(el.textContent).toContain('FRONTEND DATA GAP');
  });

  it('registra FRONTEND DATA GAP al pulsar Nueva campaña', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    const button = el.querySelector('header app-button button');
    expect(button).toBeTruthy();
    (button as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(consoleSpy).toHaveBeenLastCalledWith(
      'FRONTEND DATA GAP: no backend endpoint to create a campaign',
    );

    consoleSpy.mockRestore();
  });
});
