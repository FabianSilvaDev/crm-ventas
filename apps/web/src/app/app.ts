import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Raíz de la aplicación. **Solo el host y el outlet.**
 *
 * El shell (barra lateral, topbar, «Saltar al contenido») NO vive aquí: se movió a
 * `shell/layout.ts`, que es una ruta con hijos. El motivo es concreto: la pantalla de acceso
 * tiene que existir **fuera** de la barra lateral, y mientras el shell fuera la raíz de la
 * aplicación eso era imposible de expresar.
 *
 * Si alguien vuelve a meter navegación en esta plantilla, `app.spec.ts` lo detecta.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
