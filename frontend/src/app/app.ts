/**
 * Componente raiz: el layout del CMS.
 *
 * Mantiene el sidebar y el header estables mientras cambia el contenido, y arranca
 * los unicos sondeos del layout (estado de la API y contadores de agentes y flujos).
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './core/layout/header';
import { Sidebar } from './core/layout/sidebar';
import { HealthService } from './core/services/health.service';
import { LiveCountsService } from './core/services/live-counts.service';
import { toDataUri } from './shared/pixel/pixel-art';
import { ICONS } from './shared/pixel/icons';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Header, Sidebar],
  templateUrl: './app.html',
})
export class App {
  private readonly health = inject(HealthService);
  private readonly counts = inject(LiveCountsService);

  /** Marca pixel art del proyecto, generada desde su matriz. */
  protected readonly logo = computed(() => toDataUri(ICONS.logo, { accent: 'cyan' }, { title: 'AI Operations CMS' }));

  constructor() {
    this.health.start();
    this.counts.start();
  }
}
