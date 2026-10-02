import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SessionService } from '../core/session';
import { BOTTOM_NAV, MAIN_NAV, MORE_NAV } from '../nav-items';
import { IconComponent } from '../ui/icon/icon';

/**
 * Shell del CRM: navegación + área de trabajo.
 *
 * Nuevo diseño (Fase 1): top navigation híbrida en desktop y bottom navigation en mobile.
 * El acceso (`/entrar`) sigue viviendo fuera del shell porque es una ruta hija del padre vacío.
 *
 * `core/` son servicios de acceso al API; el shell está en `shell/` porque es layout global.
 *
 * Los menús desplegables (usuario, búsqueda, notificaciones, drawer "Más") se cierran con
 * Escape o al hacer click en el fondo. No usan CDK en esta fase para no aumentar la superficie
 * del cambio; se reevaluará cuando se añada focus-trap a11y avanzado.
 */
@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Layout {
  readonly #session = inject(SessionService);
  readonly #router = inject(Router);

  protected readonly mainNav = MAIN_NAV;
  protected readonly bottomNav = BOTTOM_NAV;
  protected readonly moreNav = MORE_NAV;

  protected readonly userMenuOpen = signal(false);
  protected readonly notificationsOpen = signal(false);
  protected readonly moreOpen = signal(false);
  protected readonly searchOpen = signal(false);

  /** Aviso fijo y no descartable mientras la sesión sea simulada. Ver `SessionService.isDemo`. */
  protected readonly demo = this.#session.isDemo;

  protected toggleUserMenu(): void {
    const opening = !this.userMenuOpen();
    this.closeAll();
    this.userMenuOpen.set(opening);
  }

  protected closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  protected toggleNotifications(): void {
    const opening = !this.notificationsOpen();
    this.closeAll();
    this.notificationsOpen.set(opening);
  }

  protected closeNotifications(): void {
    this.notificationsOpen.set(false);
  }

  protected toggleMore(): void {
    const opening = !this.moreOpen();
    this.closeAll();
    this.moreOpen.set(opening);
  }

  protected closeMore(): void {
    this.moreOpen.set(false);
  }

  protected toggleSearch(): void {
    const opening = !this.searchOpen();
    this.closeAll();
    this.searchOpen.set(opening);
  }

  protected closeSearch(): void {
    this.searchOpen.set(false);
  }

  protected openSearch(): void {
    this.toggleSearch();
  }

  /** Cierra todos los paneles con Escape. */
  @HostListener('document:keydown.escape')
  protected closeAll(): void {
    this.userMenuOpen.set(false);
    this.notificationsOpen.set(false);
    this.moreOpen.set(false);
    this.searchOpen.set(false);
  }

  protected async logout(): Promise<void> {
    this.closeAll();
    await this.#session.logout();
    await this.#router.navigate(['/entrar']);
  }
}
