import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { NAV_GROUPS, SYSTEM_NAV } from './nav-items';

/**
 * Shell del CRM: navegación + área de trabajo.
 *
 * `navOpen` controla el menú en pantallas estrechas. En escritorio el CSS ignora el estado y la
 * navegación está siempre visible, así que el botón ni se muestra.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly groups = NAV_GROUPS;
  protected readonly systemNav = SYSTEM_NAV;
  protected readonly navOpen = signal(false);

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }
}
