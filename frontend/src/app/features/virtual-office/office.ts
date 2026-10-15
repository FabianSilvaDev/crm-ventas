/**
 * Oficina virtual pixel art.
 *
 * La vista combina el escenario de PixiJS con controles y paneles de Angular: el
 * lienzo dibuja salas, muebles y agentes; todo lo administrativo (filtros, panel de
 * detalle, ejecucion de tareas) sigue siendo interfaz de Angular (seccion 8 del
 * prompt).
 *
 * El estado real vive en el backend: la vista sondea `GET /agents` para reflejar los
 * cambios que provocan las tareas y los flujos, en lugar de animar por su cuenta.
 */
import {
  type AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, interval, map, take, type Subscription } from 'rxjs';
import type { Agent, AgentStatus, Department, OfficeGrid } from '../../core/models/agents.model';
import { AGENT_STATUS_LABEL, labelOf } from '../../core/models/labels';
import { AgentsService } from '../../core/services/agents.service';
import { DepartmentsService } from '../../core/services/departments.service';
import { HealthService } from '../../core/services/health.service';
import { AsyncState } from '../../core/util/async-state';
import { AgentAvatarView } from '../../shared/components/agent-avatar/agent-avatar';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { ProgressBar } from '../../shared/components/progress-bar/progress-bar';
import { StateDisplay } from '../../shared/components/state-display/state-display';
import { StatusChip } from '../../shared/components/status-chip/status-chip';
import { STATUS_COLOR } from '../../shared/pixel/agent-sprites';
import { MinutesPipe, NumberEsPipe, PercentPipe, TimeAgoPipe } from '../../shared/pipes/format.pipes';
import { OfficeScene, type OfficeFilter } from './pixel/office-scene';

/** Cada cuanto se vuelca el estado del backend sobre el escenario (ms). */
const POLL_MS = 6000;

interface OfficeData {
  departments: Department[];
  grid: OfficeGrid;
  referenceDate: string | null;
}

@Component({
  selector: 'app-office-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AgentAvatarView,
    PixelIcon,
    ProgressBar,
    StateDisplay,
    StatusChip,
    MinutesPipe,
    NumberEsPipe,
    PercentPipe,
    TimeAgoPipe,
  ],
  templateUrl: './office.html',
  styles: [
    `
      .office-stage {
        height: 620px;
      }

      @media (max-width: 900px) {
        .office-stage {
          height: 460px;
        }
      }

      .office-overlay {
        position: absolute;
        inset: 0;
        z-index: 15;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(7, 10, 14, 0.88);
      }

      .legend__item {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .legend__dot {
        width: 8px;
        height: 8px;
      }

      .department-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: var(--px-surface-2);
        border: 2px solid var(--px-line);
        cursor: pointer;
        text-align: left;
      }

      .department-card:hover {
        border-color: var(--px-line-strong);
      }

      .department-card--active {
        box-shadow: inset 0 0 0 2px var(--px-cyan);
      }

      .department-card__name {
        font-family: var(--px-font-mono);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .capability {
        padding: 1px 6px;
        background: var(--px-surface-4);
        border: 1px solid var(--px-line-strong);
        font-family: var(--px-font-mono);
        font-size: 10px;
      }
    `,
  ],
})
export class OfficePage implements AfterViewInit {
  private readonly agentsService = inject(AgentsService);
  private readonly departmentsService = inject(DepartmentsService);
  private readonly health = inject(HealthService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly canvasHost = viewChild.required<ElementRef<HTMLElement>>('canvasHost');

  protected readonly state = new AsyncState<OfficeData>();
  protected readonly agents = signal<Agent[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly hoveredId = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly statusFilter = signal<AgentStatus | ''>('');
  protected readonly departmentFilter = signal<string | null>(null);
  /** Fallo al iniciar PixiJS (por ejemplo, sin WebGL en el navegador). */
  protected readonly sceneError = signal<string | null>(null);

  /** Tarea simulada en curso sobre el agente seleccionado. */
  protected readonly runningTask = signal<{
    id: string;
    status: string;
    progress: number;
    title: string;
    result: { summary: string; metrics: { label: string; value: string }[] } | null;
    error: string | null;
  } | null>(null);

  protected readonly statuses = Object.keys(AGENT_STATUS_LABEL) as AgentStatus[];
  protected readonly statusColor = STATUS_COLOR;

  private scene: OfficeScene | null = null;
  private sceneReady = false;
  private taskPolling: Subscription | null = null;

  protected readonly departments = computed(() => this.state.data()?.departments ?? []);
  protected readonly referenceDate = computed(() => this.state.data()?.referenceDate ?? null);

  protected readonly selectedAgent = computed(
    () => this.agents().find((agent) => agent.id === this.selectedId()) ?? null,
  );

  /** Recuento que refleja el filtro aplicado, para el HUD. */
  protected readonly counts = computed(() => {
    const agents = this.agents();
    const filter = this.currentFilter();
    const needle = filter.search.trim().toLocaleLowerCase('es');

    const visible = agents.filter(
      (agent) =>
        (!filter.departmentId || agent.department?.id === filter.departmentId) &&
        (!filter.status || agent.status === filter.status) &&
        (!needle || `${agent.name} ${agent.role}`.toLocaleLowerCase('es').includes(needle)),
    );

    return {
      total: agents.length,
      visible: visible.length,
      active: agents.filter((agent) => ['working', 'thinking', 'collaborating'].includes(agent.status)).length,
      byStatus: Object.fromEntries(
        this.statuses.map((status) => [status, agents.filter((agent) => agent.status === status).length]),
      ) as Record<AgentStatus, number>,
    };
  });

  constructor() {
    this.load();
    this.startPolling();
    // Un unico efecto sincroniza los signals con la escena de PixiJS.
    effect(() => {
      const data = this.state.data();
      const agents = this.agents();
      const filter = this.currentFilter();
      const selected = this.selectedId();

      if (!this.sceneReady || !this.scene) return;

      if (data) this.scene.setDepartments(data.departments, data.grid);
      this.scene.applyAgents(agents);
      this.scene.setFilter(filter);
      this.scene.select(selected);
    });

    this.destroyRef.onDestroy(() => {
      this.taskPolling?.unsubscribe();
      this.scene?.destroy();
      this.scene = null;
    });
  }

  /** El lienzo solo existe cuando la vista esta lista: aqui se monta PixiJS. */
  ngAfterViewInit(): void {
    void this.mountScene();
  }

  /** Monta el escenario y le entrega los datos ya disponibles. */
  protected async mountScene(): Promise<void> {
    if (this.scene) return;

    const scene = new OfficeScene({
      onSelect: (agentId) => this.selectedId.set(agentId),
      onHover: (agentId) => this.hoveredId.set(agentId),
    });

    try {
      await scene.mount(this.canvasHost().nativeElement);
    } catch (error) {
      // PixiJS 8 necesita WebGL. Si el navegador no lo ofrece, se avisa en pantalla
      // en lugar de dejar el lienzo en blanco sin explicacion.
      this.sceneError.set(
        error instanceof Error
          ? `No se ha podido iniciar el escenario pixel art: ${error.message}`
          : 'No se ha podido iniciar el escenario pixel art (WebGL no disponible).',
      );
      return;
    }

    this.sceneError.set(null);
    this.scene = scene;
    this.sceneReady = true;

    const data = this.state.data();
    if (data) scene.setDepartments(data.departments, data.grid);
    scene.applyAgents(this.agents());
    scene.setFilter(this.currentFilter());
    scene.fitAll();

    // Segundo encaje en el siguiente ciclo: asegura que el lienzo ya tiene su tamano
    // definitivo cuando se calcula la camara inicial.
    setTimeout(() => scene.fitAll(), 0);
  }

  protected load(): void {
    this.state.load(() =>
      forkJoin({
        departments: this.departmentsService.listWithGrid(),
        agents: this.agentsService.list({ pageSize: 200 }),
      }).pipe(
        take(1),
        // El estado se publica aqui para que la escena tenga datos desde el primer momento.
        map(({ departments, agents }) => {
          this.agents.set(agents.data);
          return {
            departments: departments.departments,
            grid: departments.grid,
            referenceDate: agents.meta.demoReferenceDate ?? null,
          };
        }),
      ),
    );
  }

  /** Sondeo periodico: el escenario refleja lo que hace el backend, no una animacion local. */
  private startPolling(): void {
    interval(POLL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());
  }

  protected refresh(): void {
    forkJoin({
      departments: this.departmentsService.listWithGrid(),
      agents: this.agentsService.list({ pageSize: 200 }),
    })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ departments, agents }) => {
          this.agents.set(agents.data);
          const current = this.state.data();
          if (current) {
            this.state.set({ ...current, departments: departments.departments, grid: departments.grid });
          }
        },
        // Un fallo puntual de sondeo no debe vaciar la oficina: el header ya avisa.
        error: () => undefined,
      });
  }

  // --- Filtros --------------------------------------------------------------

  private currentFilter(): OfficeFilter {
    return {
      departmentId: this.departmentFilter(),
      status: this.statusFilter() || null,
      search: this.search(),
    };
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as AgentStatus | '');
  }

  protected onDepartmentChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.departmentFilter.set(value || null);
  }

  /** Filtra por departamento desde las tarjetas inferiores. */
  protected focusDepartment(departmentId: string): void {
    const next = this.departmentFilter() === departmentId ? null : departmentId;
    this.departmentFilter.set(next);
    if (next) this.scene?.select(null);
    this.scene?.fitAll();
  }

  protected clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('');
    this.departmentFilter.set(null);
    this.selectedId.set(null);
    this.scene?.fitAll();
  }

  // --- Camara ---------------------------------------------------------------

  protected zoom(factor: number): void {
    this.scene?.zoomBy(factor);
  }

  protected fit(): void {
    this.scene?.fitAll();
  }

  protected focusSelected(): void {
    const agentId = this.selectedId();
    if (agentId) this.scene?.focusAgent(agentId);
  }

  protected statusLabelList(): { status: AgentStatus; label: string; color: string }[] {
    return this.statuses.map((status) => ({
      status,
      label: labelOf(AGENT_STATUS_LABEL, status),
      color: STATUS_COLOR[status],
    }));
  }

  // --- Acciones sobre agentes ----------------------------------------------

  /**
   * Ejecuta una tarea simulada sobre el agente seleccionado y sigue su avance por
   * polling hasta que termina. El sondeo se cancela al terminar, al fallar o al
   * destruirse la vista.
   */
  protected runTask(): void {
    const agent = this.selectedAgent();
    if (!agent || this.runningTask()?.status === 'running') return;

    this.agentsService
      .run(agent.id, { title: `Tarea simulada sobre ${agent.specialty.toLowerCase()}` })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (task) => {
          this.runningTask.set({
            id: task.id,
            status: task.status,
            progress: task.progress,
            title: task.title,
            result: null,
            error: null,
          });
          this.followTask(task.id);
        },
        error: (error: { message: string }) => {
          this.runningTask.set({
            id: 'error',
            status: 'error',
            progress: 0,
            title: 'No se pudo iniciar la tarea',
            result: null,
            error: error.message,
          });
        },
      });
  }

  private followTask(taskId: string): void {
    this.taskPolling?.unsubscribe();
    const intervalMs = this.health.simulation().pollIntervalMs;

    this.taskPolling = interval(intervalMs)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.agentsService
          .task(taskId)
          .pipe(take(1))
          .subscribe({
            next: (task) => {
              this.runningTask.set({
                id: task.id,
                status: task.status,
                progress: task.progress,
                title: task.title,
                result: task.result,
                error: task.error,
              });

              if (task.status !== 'running') {
                this.taskPolling?.unsubscribe();
                this.taskPolling = null;
                // El resultado real ya esta en el backend: se recarga el agente.
                this.refresh();
              }
            },
            error: () => {
              this.taskPolling?.unsubscribe();
              this.taskPolling = null;
            },
          });
      });
  }
}
