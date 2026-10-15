/**
 * Header del CMS.
 *
 * Reune lo que la seccion 6 del prompt pide tener siempre a la vista: la seccion
 * activa, el indicador de conexion con la API, cuantos agentes estan activos, las
 * notificaciones simuladas y el perfil ficticio del usuario.
 */
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import type { Settings } from '../models/insights.model';
import { NotificationCenterService } from '../services/notification-center.service';
import { HealthService } from '../services/health.service';
import { LiveCountsService } from '../services/live-counts.service';
import { SettingsService } from '../services/settings.service';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { AgentAvatarView } from '../../shared/components/agent-avatar/agent-avatar';
import { TimeAgoPipe } from '../../shared/pipes/format.pipes';
import { navItemForUrl } from './nav-items';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PixelIcon, AgentAvatarView, TimeAgoPipe],
  template: `
    <h1 class="app-brand__name header__section">{{ sectionTitle() }}</h1>
    <span class="text-xs text-dim header__section-detail">{{ sectionDescription() }}</span>

    <span class="spacer"></span>

    <!-- Indicador de conexion con la API -->
    <button
      type="button"
      class="conn"
      [class.conn--offline]="connection() === 'offline'"
      [class.conn--checking]="connection() === 'checking'"
      (click)="recheck()"
      [attr.title]="connectionTitle()"
    >
      <span class="conn__dot"></span>
      {{ connectionLabel() }}
      @if (health(); as status) {
        <span class="header__stat-inline">v{{ status.version }}</span>
      }
    </button>

    <div class="header__stat" title="Agentes trabajando ahora mismo">
      <span class="header__stat-value">{{ activeAgents() }}/{{ totalAgents() }}</span>
      <span class="header__stat-label">Agentes activos</span>
    </div>

    <!-- Lo que reclama tu atencion: ejecuciones detenidas esperando una decision -->
    @if (awaitingRuns() > 0) {
      <a class="chip chip--warning header__alert" routerLink="/workflows" [queryParams]="{ status: 'awaiting_approval' }">
        <app-pixel-icon name="warning" [size]="12" accent="#ffc44d" />
        {{ awaitingRuns() }} esperando tu decision
      </a>
    }

    <!-- Notificaciones simuladas -->
    <div class="notif">
      <button type="button" class="btn btn--ghost btn--icon" (click)="toggleNotifications()" aria-label="Notificaciones">
        <app-pixel-icon name="bell" [size]="16" accent="amber" />
        @if (unread() > 0) {
          <span class="notif__badge">{{ unread() }}</span>
        }
      </button>

      @if (notificationsOpen()) {
        <div class="notif__panel">
          <header class="panel__header">
            <span class="panel__title">
              Notificaciones
              <span class="panel__subtitle">{{ unread() }} sin leer</span>
            </span>
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              [disabled]="unread() === 0 || markingAll()"
              (click)="markAllRead()"
            >
              Marcar todas
            </button>
          </header>

          <div class="notif__list">
            @if (notifications().length === 0) {
              <p class="state__text" style="padding: 14px">Sin notificaciones.</p>
            }
            @for (item of notifications(); track item.id) {
              <button
                type="button"
                class="notif__item"
                [class.notif__item--unread]="!item.read"
                (click)="openNotification(item.id, item.link)"
              >
                <span class="notif__title">
                  <app-pixel-icon
                    [name]="item.level === 'error' ? 'warning' : item.level === 'success' ? 'check' : 'bell'"
                    [size]="12"
                    [accent]="levelColor(item.level)"
                  />
                  {{ item.title }}
                </span>
                <span class="notif__message">{{ item.message }}</span>
                <span class="feed__time">{{ item.at | timeAgo: referenceDate() }}</span>
              </button>
            }
          </div>
        </div>
      }
    </div>

    <!-- Perfil ficticio -->
    <div class="profile">
      @if (profile(); as user) {
        <app-agent-avatar class="profile__avatar" [avatar]="user.avatar" [size]="30" [showStatus]="false" />
        <span>
          <span class="profile__name">{{ user.name }}</span>
          <span class="profile__role">{{ user.role }}</span>
        </span>
      } @else {
        <span class="profile__name text-dim">Perfil de demostracion</span>
      }
    </div>
  `,
  styles: [
    `
      .header__section {
        font-size: 14px;
        margin: 0;
      }

      .header__section-detail {
        max-width: 42ch;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .header__stat-inline {
        font-size: 12px;
        color: var(--px-ink-2);
      }

      .notif__badge {
        position: absolute;
        top: 0;
        right: 0;
        transform: translate(35%, -35%);
      }

      .notif .btn {
        position: relative;
      }

      .profile {
        border-color: var(--px-line-strong);
      }

      /* Aviso de decisiones pendientes: es el unico elemento del header que reclama accion. */
      .header__alert {
        text-decoration: none;
        animation: px-blink 1.6s steps(2, end) infinite;
      }

      .header__alert:hover {
        text-decoration: none;
        background: #2a2410;
      }

      @media (max-width: 1200px) {
        .header__section-detail {
          display: none;
        }
      }
    `,
  ],
})
export class Header {
  private readonly router = inject(Router);
  private readonly healthService = inject(HealthService);
  private readonly counters = inject(LiveCountsService);
  private readonly notificationCenter = inject(NotificationCenterService);
  private readonly settingsService = inject(SettingsService);

  protected readonly notificationsOpen = signal(false);

  protected readonly health = this.healthService.health;
  protected readonly connection = this.healthService.connection;
  protected readonly activeAgents = this.counters.activeAgents;
  protected readonly totalAgents = this.counters.totalAgents;
  protected readonly awaitingRuns = this.counters.awaitingRuns;
  protected readonly notifications = this.notificationCenter.items;
  protected readonly unread = this.notificationCenter.unread;
  protected readonly markingAll = this.notificationCenter.markingAll;
  protected readonly referenceDate = this.notificationCenter.referenceDate;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => (event as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly sectionTitle = computed(() => navItemForUrl(this.url())?.label ?? environment.appName);
  protected readonly sectionDescription = computed(() => navItemForUrl(this.url())?.description ?? '');

  /** Perfil ficticio del workspace, cargado de la configuracion simulada. */
  protected readonly profile = signal<Settings['profile'] | null>(null);

  protected readonly connectionLabel = computed(() => {
    switch (this.connection()) {
      case 'online':
        return 'API conectada';
      case 'offline':
        return 'API sin conexion';
      default:
        return 'Comprobando API';
    }
  });

  protected readonly connectionTitle = computed(() => {
    const health = this.health();
    if (this.connection() === 'offline') {
      return `Sin respuesta de ${environment.apiBaseUrl}. Pulsa para reintentar.`;
    }
    if (!health) return 'Comprobando la conexion con la API...';

    return [
      `Version ${health.version} · Node ${health.node}`,
      `Simulacion: etapa ${health.simulation.stepMs} ms · tarea ${health.simulation.taskMs} ms`,
      `En memoria: ${health.inMemory.agents} agentes, ${health.inMemory.runs} ejecuciones, ${health.inMemory.timers} temporizadores`,
      `Memoria del proceso: ${health.memoryUsageMb} MB`,
    ].join('\n');
  });

  constructor() {
    this.notificationCenter.refresh();
    this.settingsService.get().subscribe({
      next: (settings) => this.profile.set(settings.profile),
    });
  }

  /** Cierra el panel de notificaciones al pulsar fuera de el. */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!this.notificationsOpen()) return;
    if (target?.closest('.notif')) return;
    this.notificationsOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.notificationsOpen.set(false);
  }

  protected toggleNotifications(): void {
    const next = !this.notificationsOpen();
    this.notificationsOpen.set(next);
    if (next) this.notificationCenter.refresh();
  }

  protected markAllRead(): void {
    this.notificationCenter.markAllRead();
  }

  protected openNotification(id: string, link: string | null): void {
    this.notificationCenter.markRead(id);
    if (link) void this.router.navigateByUrl(link);
    this.notificationsOpen.set(false);
  }

  protected recheck(): void {
    this.healthService.check();
    this.counters.refresh();
    this.notificationCenter.refresh();
  }

  protected levelColor(level: string): string {
    if (level === 'error') return '#d03b3b';
    if (level === 'warning') return '#ffc44d';
    if (level === 'success') return '#5ce08a';
    return '#5b9bff';
  }
}
