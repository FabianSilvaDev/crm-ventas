import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { SessionService } from '../core/session';
import { BOTTOM_NAV, MAIN_NAV, MORE_NAV } from '../nav-items';
import { Layout } from './layout';

/** Solo lo que el shell lee de la sesión. */
class FakeSession {
  readonly isDemo = signal(false);
}

describe('Layout (shell)', () => {
  let session: FakeSession;

  beforeEach(async () => {
    session = new FakeSession();

    await TestBed.configureTestingModule({
      imports: [Layout],
      providers: [provideRouter([]), { provide: SessionService, useValue: session }],
    }).compileComponents();
  });

  async function render(): Promise<{
    fixture: ComponentFixture<Layout>;
    element: HTMLElement;
  }> {
    const fixture = TestBed.createComponent(Layout);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  async function refresh(fixture: ComponentFixture<Layout>): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('muestra los enlaces principales en la topbar', async () => {
    const { element } = await render();
    const links = [...element.querySelectorAll('.topbar__nav .nav-link')].map((a) =>
      a.textContent?.trim(),
    );

    expect(links).toEqual(MAIN_NAV.map((i) => i.label));
  });

  it('la navegación principal apunta a las rutas mentales correctas', async () => {
    const { element } = await render();
    const hrefs = [...element.querySelectorAll('.topbar__nav .nav-link')].map((a) =>
      a.getAttribute('href'),
    );

    expect(hrefs).toEqual(MAIN_NAV.map((i) => i.path));
  });

  it('avisa en pantalla cuando la sesión es simulada, y calla cuando no lo es', async () => {
    const { fixture, element } = await render();
    expect(element.querySelector('.content__demo')).toBeNull();

    session.isDemo.set(true);
    await refresh(fixture);

    const aviso = element.querySelector('.content__demo');
    expect(aviso?.textContent).toContain('Sesión de demostración');
    expect(aviso?.parentElement?.querySelector('router-outlet')).not.toBeNull();
  });

  it('el menú de usuario se abre al pulsar su botón y se cierra al pulsar Escape', async () => {
    const { fixture, element } = await render();

    expect(element.querySelector('.dropdown')).toBeNull();

    const userBtn = element.querySelector('[aria-label="Menú de usuario"]') as HTMLButtonElement;
    userBtn?.click();
    await refresh(fixture);

    expect(element.querySelector('.dropdown')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await refresh(fixture);

    expect(element.querySelector('.dropdown')).toBeNull();
  });

  it('el drawer "Más" lista Productos y Configuración', async () => {
    const { fixture, element } = await render();
    const moreBtn = element.querySelector('[aria-label="Más opciones"]') as HTMLButtonElement;
    moreBtn?.click();
    await refresh(fixture);

    const drawerLinks = [...element.querySelectorAll('.drawer__link')].map((a) =>
      a.textContent?.trim(),
    );
    expect(drawerLinks).toEqual(MORE_NAV.map((i) => i.label));
  });

  it('la bottom nav contiene los 5 ítems principales más "Más"', async () => {
    const { element } = await render();
    const labels = [...element.querySelectorAll('.bottom-nav__link')].map((a) => a.textContent?.trim());

    expect(labels).toEqual([...BOTTOM_NAV.map((i) => i.label), 'Más']);
  });
});
