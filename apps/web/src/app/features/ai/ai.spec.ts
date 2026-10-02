import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { Ai } from './ai';

async function render(): Promise<ComponentFixture<Ai>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Ai],
    providers: [provideRouter([])],
  });

  const fixture = TestBed.createComponent(Ai);
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('Ai', () => {
  it('muestra el título y la acción principal', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('IA');
    expect(el.textContent).toContain('Nueva automatización');
  });

  it('renderiza recomendaciones de demostración', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Recomendaciones de IA');
    expect(el.textContent).toContain('Aumentar presupuesto de campaña');
    expect(el.textContent).toContain('82%');
    expect(el.textContent).toContain('Demo');
  });

  it('muestra agentes con estado y métricas', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Agentes');
    expect(el.textContent).toContain('GrowthBot');
    expect(el.textContent).toContain('SalesAssistant');
    expect(el.textContent).toContain('91%');
  });

  it('muestra actividad reciente de agentes', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Actividad reciente');
    expect(el.textContent).toContain('Detecté un segmento de alto interés');
    expect(el.textContent).toContain('GrowthBot');
  });

  it('muestra empty state de uso y costos', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Uso y costos');
    expect(el.textContent).toContain('Sin datos de uso');
  });

  it('declara el origen de los datos con badge Demo', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('De dónde salen estos datos');
    expect(el.textContent).toContain('FRONTEND DATA GAP');
    expect(el.textContent).toContain('Demo');
  });

  it('registra FRONTEND DATA GAP al pulsar Nueva automatización', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    const button = el.querySelector('header app-button button');
    expect(button).toBeTruthy();
    (button as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(consoleSpy).toHaveBeenLastCalledWith(
      'FRONTEND DATA GAP: no backend endpoint to create automation',
    );

    consoleSpy.mockRestore();
  });
});
