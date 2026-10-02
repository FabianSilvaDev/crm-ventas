import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import type {
  ActivatedRouteSnapshot,
  GuardResult,
  MaybeAsync,
  RouterStateSnapshot,
} from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { SessionService } from '../core/session';
import { authGuard } from './auth.guard';

/**
 * El guard, probado como lo que es: una función que decide.
 *
 * No se monta ninguna pantalla ni ningún router: se llama al guard dentro de un contexto de inyección
 * y se mira **qué devuelve**. Es lo que permite afirmar sobre el destino exacto en vez de sobre el
 * texto que acaba pintado.
 */

class FakeSession {
  restaurada = false;
  llamadas = 0;

  async ensureRestored(): Promise<boolean> {
    this.llamadas += 1;

    return this.restaurada;
  }
}

/** El guard no lee ninguno de los dos: solo usa `estado.url`. Se pasan vacíos a propósito. */
const RUTA = {} as ActivatedRouteSnapshot;
const estado = (url: string): RouterStateSnapshot => ({ url }) as RouterStateSnapshot;

describe('authGuard', () => {
  let session: FakeSession;

  beforeEach(() => {
    TestBed.resetTestingModule();
    session = new FakeSession();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SessionService, useValue: session }],
    });
  });

  /**
   * Llama al guard como lo llama el router. El tipo de retorno es `MaybeAsync<GuardResult>` y no
   * `Promise<boolean | UrlTree>` porque es **el tipo que declara `CanActivateFn`**: el guard es
   * `async` hoy, pero el contrato de la función permite también un observable, y escribir aquí el
   * tipo estrecho obligaría a mentir en la firma para que compilara.
   */
  function decidir(url: string): MaybeAsync<GuardResult> {
    return TestBed.runInInjectionContext(() => authGuard(RUTA, estado(url)));
  }

  it('con sesión, deja pasar', async () => {
    session.restaurada = true;

    await expect(decidir('/leads')).resolves.toBe(true);
  });

  it('sin sesión, manda al acceso con la pantalla que se pedía', async () => {
    session.restaurada = false;

    const resultado = await decidir('/leads?estado=NEW');

    expect(resultado).toBeInstanceOf(UrlTree);

    const arbol = resultado as UrlTree;
    expect(arbol.root.children['primary']?.segments.map((s) => s.path)).toEqual(['entrar']);
    // La query viaja ENTERA: volver a donde estabas incluye los filtros que tenías puestos.
    expect(arbol.queryParams['returnTo']).toBe('/leads?estado=NEW');
  });

  it('pregunta por la sesión antes de decidir, no lee un booleano viejo', async () => {
    // Es la diferencia entre entrar al recargar la página y que te expulsen en cada recarga: el access
    // token vive en memoria, así que al arrancar hay que preguntarle al servidor por la cookie.
    session.restaurada = true;

    await decidir('/leads');

    expect(session.llamadas).toBe(1);
  });

  it('la raíz también pasa por el guard', async () => {
    session.restaurada = false;

    const resultado = await decidir('/');

    expect(resultado).toBeInstanceOf(UrlTree);
    expect((resultado as UrlTree).queryParams['returnTo']).toBe('/');
  });
});
