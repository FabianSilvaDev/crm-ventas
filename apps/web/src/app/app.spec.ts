import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { NAV_GROUPS } from './nav-items';

describe('App (shell)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lista los grupos de navegación como encabezados reales', async () => {
    const el = await render();
    const headings = [...el.querySelectorAll('.nav__heading')].map((h) => h.textContent?.trim());

    expect(headings).toEqual([...NAV_GROUPS.map((g) => g.heading), 'Sistema']);
  });

  it('una etapa sin implementar NO es un enlace', async () => {
    // Contrato de honestidad de la interfaz: si no navega a ninguna parte, no debe parecer
    // que sí. Un <a> que no lleva a nada es peor que un texto marcado como pendiente.
    const el = await render();

    const pending = [...el.querySelectorAll('.nav__link--pending')];
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((node) => node.tagName === 'SPAN')).toBe(true);
    expect(pending.every((node) => node.querySelector('.nav__tag')?.textContent?.trim() === 'pendiente')).toBe(true);
  });

  it('las etapas implementadas sí son enlaces', async () => {
    const el = await render();

    const links = [...el.querySelectorAll('a.nav__link')].map((a) => a.getAttribute('href'));
    expect(links).toContain('/sistema');
  });

  it('el menú arranca cerrado en pantalla estrecha', async () => {
    const el = await render();

    const toggle = el.querySelector('.nav-toggle');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('#nav-principal')?.classList.contains('nav--open')).toBe(false);
  });
});
