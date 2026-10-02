import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { Dashboard } from './dashboard';

/**
 * Tests estructurales del panel. No hay backend todavía, así que lo único que se puede
 * verificar es que la pantalla dice la verdad: muestra los módulos, los KPIs vacíos y la
 * declaración de origen de los datos.
 */

describe('Dashboard', () => {
  async function render(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(Dashboard);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra el título del panel y la estructura del ciclo comercial', async () => {
    const el = await render();

    expect(el.textContent).toContain('Resumen del día');
    expect(el.textContent).toContain('Investigación');
    expect(el.textContent).toContain('Estrategia');
    expect(el.textContent).toContain('Adquisición');
    expect(el.textContent).toContain('CRM / Ventas');
    expect(el.textContent).toContain('Aprendizaje');
  });

  it('cada card de módulo muestra métricas vacías y sin inventar valores', async () => {
    const el = await render();

    const values = [...el.querySelectorAll('.module-card__metric-value')].map((n) =>
      n.textContent?.trim(),
    );

    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => v === '—')).toBe(true);
  });

  it('declara que no hay datos reales', async () => {
    const el = await render();

    expect(el.textContent).toContain('De dónde salen estos datos');
    expect(el.textContent).toContain('Nada');
  });

  it('los módulos sin ruta se muestran como próximamente, no como enlaces rotos', async () => {
    const el = await render();

    const pending = [...el.querySelectorAll('.module-card__link--disabled')];
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((n) => n.tagName === 'SPAN')).toBe(true);
  });
});
