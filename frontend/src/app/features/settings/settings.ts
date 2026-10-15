/**
 * Configuracion: espacio de trabajo, perfil, parametros de simulacion, politica de
 * datos, integraciones, banderas de funcionalidad, estado de ejecucion y avisos.
 *
 * Todo lo que se muestra aqui es informacion real del backend:
 *  - `GET /settings`          -> workspace, perfil, simulacion, integraciones y runtime.
 *  - `GET /notifications`     -> bandeja del header.
 *  - `POST /notifications/:id/read` y `POST /notifications/read-all` marcan como
 *    leidas de verdad (el estado vive en la memoria del backend) y la lista se
 *    vuelve a pedir despues de cada accion.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { type Observable, map, take } from 'rxjs';
import type { Integration, Notification, Settings } from '../../core/models/insights.model';
import { NotificationsService } from '../../core/services/activity.service';
import { SettingsService } from '../../core/services/settings.service';
import { AsyncState } from '../../core/util/async-state';
import { AgentAvatarView } from '../../shared/components/agent-avatar/agent-avatar';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { StateDisplay } from '../../shared/components/state-display/state-display';
import { StatusChip } from '../../shared/components/status-chip/status-chip';
import { formatNumber, formatPercent } from '../../shared/format/format';
import { DurationPipe, NumberEsPipe, TimeAgoPipe } from '../../shared/pipes/format.pipes';

/** Parametro de simulacion presentado con su explicacion y su variable de entorno. */
interface SimulationParameter {
  key: string;
  label: string;
  value: string;
  explanation: string;
  envVariable: string;
}

/**
 * Estado de una integracion. Ninguna esta conectada: dos son simuladas dentro del
 * backend y el resto estan deshabilitadas a proposito.
 */
const INTEGRATION_STATUS_LABEL: Record<Integration['status'], string> = {
  disabled: 'Deshabilitada',
  simulated: 'Simulada',
  connected: 'Conectada',
};

const INTEGRATION_STATUS_TONE: Record<Integration['status'], string> = {
  disabled: 'chip--neutral',
  simulated: 'chip--warning',
  connected: 'chip--good',
};

/** Bandeja de notificaciones con el recuento que publica `meta`. */
interface NotificationsView {
  items: Notification[];
  unread: number;
  total: number;
}

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    AgentAvatarView,
    PixelIcon,
    StateDisplay,
    StatusChip,
    DurationPipe,
    NumberEsPipe,
    TimeAgoPipe,
  ],
  templateUrl: './settings.html',
  styles: [
    `
      .setting-note {
        font-size: 11.5px;
        color: var(--px-ink-muted);
      }

      .env-var {
        font-family: var(--px-font-mono);
        font-size: 10px;
        padding: 0 4px;
        background: var(--px-bg-deep);
        border: 1px solid var(--px-line);
      }

      .flag-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: start;
        padding: 9px 12px;
        border-bottom: 1px solid var(--px-line);
      }

      .flag-row:last-child {
        border-bottom: 0;
      }

      /* En esta vista la bandeja no es un desplegable: el aviso no es clicable. */
      .notif__item {
        cursor: default;
      }
    `,
  ],
})
export class SettingsPage {
  private readonly settingsService = inject(SettingsService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = new AsyncState<Settings>();
  protected readonly notificationsState = new AsyncState<NotificationsView>();

  /** Filtro de la bandeja: solo avisos sin leer. */
  protected readonly unreadOnly = signal(false);
  /** Accion en curso, para deshabilitar los botones mientras se resuelve. */
  protected readonly busy = signal(false);
  /** Error de la ultima accion sobre una notificacion. */
  protected readonly actionError = signal<string | null>(null);

  constructor() {
    this.state.load(() => this.settingsService.get());
    this.loadNotifications();
  }

  protected load(): void {
    this.state.load(() => this.settingsService.get(), { keepData: true });
    this.loadNotifications();
  }

  // --- Notificaciones -------------------------------------------------------------

  private notificationsSource() {
    return this.notificationsService.list({ unreadOnly: this.unreadOnly(), limit: 20 }).pipe(
      map((response) => {
        const unread = response.meta['unread'];
        return {
          items: response.data,
          total: response.meta.total ?? response.data.length,
          unread: typeof unread === 'number' ? unread : response.data.filter((item) => !item.read).length,
        };
      }),
    );
  }

  protected loadNotifications(): void {
    this.notificationsState.load(() => this.notificationsSource(), { keepData: true });
  }

  protected toggleUnreadOnly(): void {
    this.unreadOnly.update((value) => !value);
    this.loadNotifications();
  }

  protected markRead(notificationId: string): void {
    this.runAction(this.notificationsService.markRead(notificationId));
  }

  protected markAllRead(): void {
    this.runAction(this.notificationsService.markAllRead());
  }

  /** Ejecuta la accion y vuelve a pedir la bandeja: el estado real lo manda la API. */
  private runAction(source: Observable<unknown>): void {
    this.busy.set(true);
    this.actionError.set(null);

    source.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.loadNotifications();
      },
      error: () => {
        this.busy.set(false);
        this.actionError.set(
          'No se ha podido actualizar la notificacion. Comprueba que el backend responde y vuelve a intentarlo.',
        );
      },
    });
  }

  // --- Datos derivados ------------------------------------------------------------

  protected readonly settings = computed(() => this.state.data());
  protected readonly workspace = computed(() => this.state.data()?.workspace ?? null);
  protected readonly profile = computed(() => this.state.data()?.profile ?? null);
  protected readonly dataPolicy = computed(() => this.state.data()?.dataPolicy ?? null);
  protected readonly integrations = computed(() => this.state.data()?.integrations ?? []);
  protected readonly featureFlags = computed(() => this.state.data()?.featureFlags ?? []);
  protected readonly runtime = computed(() => this.state.data()?.runtime ?? null);
  protected readonly notifications = computed(() => this.notificationsState.data()?.items ?? []);
  protected readonly unreadCount = computed(() => this.notificationsState.data()?.unread ?? 0);
  protected readonly notificationsTotal = computed(() => this.notificationsState.data()?.total ?? 0);

  /** Parametros de simulacion con el nombre real de la variable que los ajusta. */
  protected readonly simulationParameters = computed<SimulationParameter[]>(() => {
    const simulation = this.settings()?.simulation;
    if (!simulation) return [];

    return [
      {
        key: 'stepMs',
        label: 'Duracion por etapa',
        value: `${formatNumber(simulation.stepMs, 0)} ms`,
        explanation: 'Tiempo que tarda la simulacion en completar cada etapa de un flujo de agentes.',
        envVariable: 'SIMULATION_STEP_MS',
      },
      {
        key: 'taskMs',
        label: 'Duracion por tarea',
        value: `${formatNumber(simulation.taskMs, 0)} ms`,
        explanation: 'Tiempo del calculo simulado de una tarea suelta lanzada sobre un agente.',
        envVariable: 'SIMULATION_TASK_MS',
      },
      {
        key: 'tickMs',
        label: 'Cadencia del temporizador',
        value: `${formatNumber(simulation.tickMs, 0)} ms`,
        explanation: 'Cada cuanto avanza el temporizador interno el progreso de etapas y tareas en segundo plano.',
        envVariable: 'SIMULATION_TICK_MS',
      },
      {
        key: 'failureRate',
        label: 'Tasa de fallo',
        value: formatPercent(simulation.failureRate, 1),
        explanation: 'Probabilidad de error controlado por etapa. Con 0 no se simula ningun fallo.',
        envVariable: 'SIMULATION_FAILURE_RATE',
      },
      {
        key: 'maxRuns',
        label: 'Ejecuciones simultaneas',
        value: formatNumber(simulation.maxRuns, 0),
        explanation: 'Numero maximo de ejecuciones de flujo que se conservan a la vez en memoria.',
        envVariable: 'SIMULATION_MAX_RUNS',
      },
      {
        key: 'pollIntervalMs',
        label: 'Intervalo de sondeo',
        value: `${formatNumber(simulation.pollIntervalMs, 0)} ms`,
        explanation: 'Cadencia de consulta que la API sugiere al frontend para refrescar el estado en vivo.',
        envVariable: 'POLL_INTERVAL_MS',
      },
    ];
  });

  /** Milisegundos encendido: la API lo publica en segundos. */
  protected readonly uptimeMs = computed(() => (this.runtime()?.uptimeSeconds ?? 0) * 1000);

  // --- Utilidades de plantilla ----------------------------------------------------

  protected integrationStatusLabel(status: Integration['status']): string {
    return INTEGRATION_STATUS_LABEL[status] ?? status;
  }

  protected integrationStatusTone(status: Integration['status']): string {
    return INTEGRATION_STATUS_TONE[status] ?? 'chip--neutral';
  }

  protected flagTone(enabled: boolean): string {
    return enabled ? 'chip--good' : 'chip--neutral';
  }
}
