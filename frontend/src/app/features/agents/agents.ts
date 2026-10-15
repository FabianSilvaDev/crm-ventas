/**
 * Agentes: la plantilla completa, sus filtros y la ejecucion de tareas simuladas.
 *
 * Todo lo que se ve viene de la API (`GET /agents`, `GET /agents/summary` y
 * `GET /departments`); la vista solo compone etiquetas y no calcula cifras nuevas.
 *
 * La unica accion con efecto es "Ejecutar tarea simulada": lanza
 * `POST /agents/:id/run`, que responde 202 Accepted, y sigue la tarea por polling
 * con el intervalo que publica la API hasta que termina (completed o error).
 */
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';
import type { NormalizedApiError } from '../../core/models/api.model';
import type { Agent, AgentStatus, AgentStatusSummary, AgentTask, Department } from '../../core/models/agents.model';
import { AGENT_STATUS_LABEL, labelOf } from '../../core/models/labels';
import { AgentsService, type AgentQuery } from '../../core/services/agents.service';
import { DepartmentsService } from '../../core/services/departments.service';
import { HealthService } from '../../core/services/health.service';
import { AsyncState } from '../../core/util/async-state';
import { AgentAvatarView } from '../../shared/components/agent-avatar/agent-avatar';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { ProgressBar } from '../../shared/components/progress-bar/progress-bar';
import { StatTile } from '../../shared/components/stat-tile/stat-tile';
import { StateDisplay } from '../../shared/components/state-display/state-display';
import { StatusChip } from '../../shared/components/status-chip/status-chip';
import {
  DateEsPipe,
  DurationPipe,
  MinutesPipe,
  NumberEsPipe,
  PercentPipe,
  TimeAgoPipe,
} from '../../shared/pipes/format.pipes';

/** Orden admitido por `GET /agents?sort=`, con su etiqueta en espanol. */
type AgentSort = NonNullable<AgentQuery['sort']>;

const SORT_OPTIONS: { value: AgentSort; label: string }[] = [
  { value: 'name', label: 'Nombre' },
  { value: 'level', label: 'Nivel' },
  { value: 'status', label: 'Estado' },
  { value: 'tasks', label: 'Tareas completadas' },
];

/** Todo lo que necesita la vista, resuelto en una sola carga. */
interface AgentsView {
  agents: Agent[];
  total: number;
  referenceDate: string | null;
  departments: Department[];
  summary: AgentStatusSummary;
  /** Estados que acepta el filtro, tal como los publica la API en `meta.filters`. */
  statuses: AgentStatus[];
}

@Component({
  selector: 'app-agents-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AgentAvatarView,
    PixelIcon,
    ProgressBar,
    StatTile,
    StateDisplay,
    StatusChip,
    DateEsPipe,
    DurationPipe,
    MinutesPipe,
    NumberEsPipe,
    PercentPipe,
    TimeAgoPipe,
  ],
  templateUrl: './agents.html',
  styles: [
    `
      /* Fila seleccionada: la seleccion no puede depender solo del avatar. */
      .agent-row--selected td,
      .agent-row--selected th {
        background: var(--px-surface-3);
      }

      .agent-cell {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .agent-cell__text {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }

      .agent-filters {
        align-items: flex-end;
      }
    `,
  ],
})
export class AgentsPage {
  private readonly agentsService = inject(AgentsService);
  private readonly departmentsService = inject(DepartmentsService);
  private readonly health = inject(HealthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = new AsyncState<AgentsView>();

  // --- Filtros (cada cambio recarga el listado contra la API) ------------------

  protected readonly search = signal('');
  protected readonly departmentId = signal('');
  protected readonly status = signal<AgentStatus | ''>('');
  protected readonly sort = signal<AgentSort>('name');
  protected readonly sortOptions = SORT_OPTIONS;

  /** Temporizador del buscador: evita una peticion por cada tecla. */
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // --- Tarea simulada en curso ------------------------------------------------

  protected readonly task = signal<AgentTask | null>(null);
  protected readonly taskRunning = signal(false);
  protected readonly taskError = signal<string | null>(null);
  /** Temporizador del sondeo, en un signal para poder cancelarlo sin fugas. */
  private readonly pollTimer = signal<ReturnType<typeof setTimeout> | null>(null);

  protected readonly selectedId = signal<string | null>(null);

  constructor() {
    this.load();
    this.destroyRef.onDestroy(() => {
      this.clearSearchTimer();
      this.stopPolling();
    });
  }

  // --- Carga ------------------------------------------------------------------

  /** Peticion de la vista: agentes filtrados, departamentos y resumen por estado. */
  private source() {
    return forkJoin({
      agents: this.agentsService.list({
        departmentId: this.departmentId() || undefined,
        status: this.status() || undefined,
        search: this.search().trim() || undefined,
        sort: this.sort(),
      }),
      departments: this.departmentsService.list(),
      summary: this.agentsService.summary(),
    }).pipe(
      map(({ agents, departments, summary }) => {
        const filters = (agents.meta['filters'] ?? {}) as { statuses?: AgentStatus[] };

        return {
          agents: agents.data,
          total: agents.meta.total ?? agents.data.length,
          referenceDate: agents.meta.demoReferenceDate ?? null,
          departments: departments.data,
          summary: summary.summary,
          statuses: filters.statuses ?? [],
        };
      }),
    );
  }

  protected load(): void {
    this.state.load(() => this.source());
  }

  /** Recarga conservando los datos en pantalla: los filtros no hacen parpadear la tabla. */
  private reload(): void {
    this.state.load(() => this.source(), { keepData: true });
  }

  protected refresh(): void {
    this.reload();
  }

  // --- Filtros ----------------------------------------------------------------

  protected onSearchInput(value: string): void {
    this.search.set(value);
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.reload();
    }, 300);
  }

  protected onDepartmentChange(value: string): void {
    this.departmentId.set(value);
    this.reload();
  }

  protected onStatusChange(value: string): void {
    this.status.set(value === '' ? '' : (value as AgentStatus));
    this.reload();
  }

  protected onSortChange(value: string): void {
    this.sort.set(value as AgentSort);
    this.reload();
  }

  /** Devuelve la vista a su estado inicial: sin filtros y con el orden por defecto. */
  protected clearFilters(): void {
    this.clearSearchTimer();
    this.search.set('');
    this.departmentId.set('');
    this.status.set('');
    this.sort.set('name');
    this.reload();
  }

  protected readonly hasFilters = computed(
    () => this.search().trim() !== '' || this.departmentId() !== '' || this.status() !== '' || this.sort() !== 'name',
  );

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  // --- Datos derivados --------------------------------------------------------

  protected readonly agents = computed(() => this.state.data()?.agents ?? []);
  protected readonly departments = computed(() => this.state.data()?.departments ?? []);
  protected readonly statuses = computed(() => this.state.data()?.statuses ?? []);
  protected readonly total = computed(() => this.state.data()?.total ?? 0);
  protected readonly referenceDate = computed(() => this.state.data()?.referenceDate ?? null);

  /** Contadores de cabecera: total, activos, en error y fuera de linea. */
  protected readonly counters = computed(() => {
    const summary = this.state.data()?.summary;
    if (!summary) return null;

    return {
      total: summary.total,
      active: summary.active,
      error: summary.byStatus.error ?? 0,
      offline: summary.byStatus.offline ?? 0,
      byStatus: summary.byStatus,
    };
  });

  /** Agente mostrado en el panel lateral: el seleccionado o, si no hay, el primero. */
  protected readonly selected = computed<Agent | null>(() => {
    const agents = this.agents();
    if (agents.length === 0) return null;

    return agents.find((agent) => agent.id === this.selectedId()) ?? agents[0];
  });

  protected statusLabel(status: string): string {
    return labelOf(AGENT_STATUS_LABEL, status);
  }

  /** Intervalo de sondeo vigente: lo publica la API y lo usan las tareas simuladas. */
  protected readonly pollIntervalMs = computed(() => this.health.simulation().pollIntervalMs);

  // --- Ejecucion de tareas simuladas ------------------------------------------

  protected select(agentId: string): void {
    this.selectedId.set(agentId);
    this.task.set(null);
    this.taskError.set(null);
  }

  /**
   * Lanza la tarea simulada del agente y empieza a seguirla.
   * `POST /agents/:id/run` devuelve 202 Accepted con la tarea en `running`.
   */
  protected runTask(agent: Agent): void {
    if (this.taskRunning()) return;

    this.stopPolling();
    this.task.set(null);
    this.taskError.set(null);
    this.taskRunning.set(true);

    this.agentsService
      .run(agent.id, { title: `Tarea simulada de ${agent.name}` })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (task) => this.followTask(task),
        error: (error: NormalizedApiError) => {
          this.taskError.set(error.message);
          this.taskRunning.set(false);
        },
      });
  }

  /**
   * Registra el ultimo estado conocido de la tarea y decide si hay que seguir
   * sondeando. El sondeo se detiene al completar, al fallar y al destruir la vista.
   */
  private followTask(task: AgentTask): void {
    this.task.set(task);

    if (task.status !== 'running') {
      this.stopPolling();
      this.taskRunning.set(false);
      // La tarea ha cambiado el estado y el resultado reciente del agente.
      this.reload();
      return;
    }

    const delay = this.health.simulation().pollIntervalMs;
    this.pollTimer.set(
      setTimeout(() => {
        this.pollTimer.set(null);
        this.pollTask(task.id);
      }, delay),
    );
  }

  /** Una consulta de estado; el siguiente sondeo lo agenda `followTask`. */
  private pollTask(taskId: string): void {
    this.agentsService
      .task(taskId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (task) => this.followTask(task),
        error: (error: NormalizedApiError) => {
          this.stopPolling();
          this.taskRunning.set(false);
          this.taskError.set(error.message);
        },
      });
  }

  private stopPolling(): void {
    const timer = this.pollTimer();
    if (timer !== null) {
      clearTimeout(timer);
      this.pollTimer.set(null);
    }
  }
}
