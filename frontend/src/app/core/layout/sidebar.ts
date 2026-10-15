/**
 * Navegacion lateral del CMS.
 *
 * Los contadores son datos reales de la API (agentes activos, flujos en curso),
 * no adornos: cada contador tiene una seccion donde se puede verificar.
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LiveCountsService } from '../services/live-counts.service';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { NAV_GROUPS, NAV_ITEMS, type NavItem } from './nav-items';

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, PixelIcon],
  template: `
    <nav class="nav" aria-label="Secciones del CMS">
      @for (group of groups; track group) {
        <p class="nav__group-label">{{ group }}</p>

        @for (item of itemsOf(group); track item.path) {
          <a
            class="nav__item"
            [routerLink]="item.path"
            routerLinkActive="nav__item--active"
            [attr.title]="item.description"
          >
            <app-pixel-icon class="nav__icon" [name]="item.icon" [size]="16" [accent]="item.accent" />
            <span class="nav__label">{{ item.label }}</span>
            @if (counterOf(item); as count) {
              <span class="nav__count" [class.nav__count--alert]="needsAttention(item)">{{ count }}</span>
            }
          </a>
        }
      }
    </nav>

    <footer class="nav__footer">
      <p class="text-mono text-xs">Datos simulados</p>
      <p class="text-xs text-faint">Las ejecuciones viven en memoria y se pierden al reiniciar el backend.</p>
    </footer>
  `,
})
export class Sidebar {
  private readonly counters = inject(LiveCountsService);

  protected readonly groups = NAV_GROUPS;

  protected itemsOf(group: NavItem['group']): NavItem[] {
    return NAV_ITEMS.filter((item) => item.group === group);
  }

  private readonly counts = computed(() => ({
    activeAgents: this.counters.activeAgents(),
    runningRuns: this.counters.runningRuns(),
    newLeads: 0,
  }));

  /** Devuelve el contador a mostrar, u `null` si es cero o no aplica. */
  protected counterOf(item: NavItem): number | null {
    if (!item.counter) return null;

    if (item.counter === 'runningRuns') {
      // Las ejecuciones que esperan una decision son las que reclaman atencion: se
      // suman a las que estan en marcha y se destacan aparte.
      const pending = this.counters.runningRuns() + this.counters.awaitingRuns();
      return pending > 0 ? pending : null;
    }

    const value = this.counts()[item.counter];
    return value > 0 ? value : null;
  }

  /** `true` cuando el contador de flujos incluye decisiones pendientes del operador. */
  protected needsAttention(item: NavItem): boolean {
    return item.counter === 'runningRuns' && this.counters.awaitingRuns() > 0;
  }
}
