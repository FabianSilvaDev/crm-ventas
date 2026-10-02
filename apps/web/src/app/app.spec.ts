import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

/**
 * `App` es la raíz y no debe tener contenido propio: el shell es una ruta (`shell/layout.ts`) y
 * las pantallas cuelgan de ella. Lo que aquí se vigila es una **regresión concreta**: que alguien
 * vuelva a meter la barra lateral en la raíz, con lo que la pantalla de acceso —que tiene que
 * existir fuera del shell— dejaría de ser posible.
 *
 * Los asertos del shell viven en `shell/layout.spec.ts`, donde está el componente que los cumple.
 */
describe('App (raíz)', () => {
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

  it('deja el contenido a la ruta activa', async () => {
    const el = await render();

    expect(el.querySelector('router-outlet')).not.toBeNull();
  });

  it('NO renderiza navegación: el shell es una ruta, no la raíz', async () => {
    const el = await render();

    expect(el.querySelector('.nav')).toBeNull();
    expect(el.querySelector('.skip-link')).toBeNull();
    expect(el.querySelector('#contenido')).toBeNull();
  });
});
