/**
 * Flujo de agentes.
 *
 * Vista de izquierda a derecha con las 17 etapas del sistema (seccion 9 del prompt):
 *  - El estado NO se anima en el cliente: el backend mantiene la ejecucion y esta
 *    vista la consulta por polling, de modo que el avance sobrevive a recargas y
 *    pausar, reanudar y reiniciar son operaciones reales sobre el servidor.
 *  - Las dependencias entre etapas se dibujan: las consecutivas sobre la linea del
 *    flujo y las que saltan etapas con una curva discontinua por debajo.
 *  - El panel de detalle muestra el resultado que devuelve el backend al completar
 *    cada etapa (resumen, metricas y artefactos enlazables). Mientras no hay
 *    ejecucion, muestra el resultado previsto de la plantilla, que es informacion
 *    real del catalogo de etapas.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { type Observable, type Subscription, interval, take } from 'rxjs';
import type { AgentRef, DepartmentRef } from '../../core/models/agents.model';
import { RUN_STATUS_LABEL, STAGE_LABEL_OVERRIDE, STAGE_STATUS_LABEL, labelOf } from '../../core/models/labels';
import type {
  RunStage,
  StageGate,
  StageResult,
  StageStatus,
  Workflow,
  WorkflowRun,
  WorkflowStage,
} from '../../core/models/workflows.model';
import { HealthService } from '../../core/services/health.service';
import { WorkflowsService } from '../../core/services/workflows.service';
import { AsyncState } from '../../core/util/async-state';
import { AgentAvatarView } from '../../shared/components/agent-avatar/agent-avatar';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { ProgressBar } from '../../shared/components/progress-bar/progress-bar';
import { StateDisplay } from '../../shared/components/state-display/state-display';
import { StatusChip } from '../../shared/components/status-chip/status-chip';
import { STATUS_COLOR } from '../../shared/pixel/agent-sprites';
import { DateEsPipe, DurationPipe, MinutesPipe, TimeAgoPipe } from '../../shared/pipes/format.pipes';

/**
 * Geometria de la banda de etapas.
 * Debe coincidir con `.flow-node` (ancho fijo) y con el `gap` de `.flow__inner`:
 * el SVG de dependencias necesita exactamente las mismas coordenadas que el HTML.
 */
const NODE_WIDTH = 202;
const NODE_HEIGHT = 226;
const NODE_GAP = 14;
const FLOW_PADDING_LEFT = 6;
const TRACK_Y = 54;
const DEPENDENCY_Y = NODE_HEIGHT + 18;

interface DependencyLine {
  key: string;
  d: string;
  dashed: boolean;
}

/** Vista normalizada de una etapa: sirve tanto para la plantilla como para una ejecucion. */
interface StageView {
  key: string;
  order: number;
  name: string;
  spanishName: string;
  summary: string;
  description: string;
  inputs: string[];
  deliverables: string[];
  dependsOn: string[];
  department: DepartmentRef | null;
  agents: AgentRef[];
  /** Puerta de decision de la etapa, o `null` si no la tiene. */
  gate: StageGate | null;
  estimatedMinutes: number;
  status: StageStatus;
  progress: number;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number;
  result: StageResult | null;
  error: string | null;
  /** `true` cuando la etapa viene de la plantilla y aun no se ha ejecutado. */
  planned: boolean;
}

/** Ruta del CMS donde se puede ver el artefacto que produce una etapa. */
const ARTIFACT_ROUTES: Record<string, string> = {
  product: '/products',
  offer: '/products',
  campaign: '/campaigns',
  'landing-page': '/landing-pages',
  content: '/content',
  creative: '/content',
  research: '/research',
  analytics: '/analytics',
  lead: '/leads',
  agent: '/agents',
  workflow: '/workflows',
  opportunity: '/workflows',
  learning: '/workflows',
};

@Component({
  selector: 'app-workflows-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    AgentAvatarView,
    PixelIcon,
    ProgressBar,
    StateDisplay,
    StatusChip,
    DateEsPipe,
    DurationPipe,
    MinutesPipe,
    TimeAgoPipe,
  ],
  templateUrl: './workflows.html',
  styles: [
    `
      .flow-node {
        width: ${NODE_WIDTH}px;
        height: ${NODE_HEIGHT}px;
      }

      .flow__inner {
        position: relative;
        display: flex;
        gap: ${NODE_GAP}px;
        padding-left: ${FLOW_PADDING_LEFT}px;
      }

      .flow__deps {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        overflow: visible;
      }

      .stage-result {
        padding: 10px;
        background: var(--px-surface-1);
        border: 2px solid var(--px-line);
      }

      .artifact {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 7px;
        background: var(--px-surface-4);
        border: 1px solid var(--px-line-strong);
        font-family: var(--px-font-mono);
        font-size: 10px;
      }

      .flow__agents {
        margin-top: auto;
      }

      /* Puerta de decision abierta: el panel que pide la decision del operador. */
      .gate-panel {
        border-color: var(--px-amber);
        box-shadow: var(--px-inset-light), var(--px-shadow);
      }
    `,
  ],
})
export class WorkflowsPage {
  private readonly workflowsService = inject(WorkflowsService);
  private readonly health = inject(HealthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = new AsyncState<Workflow[]>();
  protected readonly workflow = signal<Workflow | null>(null);
  protected readonly run = signal<WorkflowRun | null>(null);
  protected readonly selectedStageKey = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly referenceDate = signal<string | null>(null);
  /** Color por estado de agente, para los puntos de la lista de responsables. */
  protected readonly statusColor = STATUS_COLOR;

  /** Decision sobre la puerta abierta. */
  protected readonly gateReason = signal('');
  protected readonly gateDeciding = signal(false);
  protected readonly gateError = signal<string | null>(null);
  /** Aviso tras rechazar: la oportunidad asociada ha quedado descartada. */
  protected readonly gateOutcome = signal<string | null>(null);

  /**
   * Identificador de ejecucion que llega por la URL (`?run=run-xxx`).
   * Lo usa el lanzamiento desde la cola de oportunidades para abrir esa ejecucion.
   */
  readonly runParam = input('');

  private runPolling: Subscription | null = null;

  constructor() {
    this.state.load(() => this.reloadFlows());
    this.loadWorkflow('wf-full-cycle');
    this.attachToActiveRun();
  }

  /**
   * Reengancha con la ejecucion que siga viva en el backend.
   *
   * El estado de una ejecucion vive en el servidor, no en la vista: si se recarga la
   * pagina a mitad de una simulacion, lo correcto es seguir mostrandola en lugar de
   * dejarla corriendo de forma invisible. Con `?run=<id>` se abre esa ejecucion en
   * concreto, que es como llega aqui el lanzamiento desde la cola de oportunidades.
   */
  private attachToActiveRun(): void {
    const requested = this.runParam();

    if (requested) {
      this.workflowsService
        .run(requested)
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (run) => this.attach(run),
          // Si la ejecucion ya no existe (por ejemplo, tras reiniciar el backend),
          // se cae al comportamiento normal en lugar de dejar la vista vacia.
          error: () => this.attachToMostRecentRun(),
        });
      return;
    }

    this.attachToMostRecentRun();
  }

  private attachToMostRecentRun(): void {
    this.workflowsService
      .runs({ pageSize: 10 })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const active = response.data.find((item) => item.status === 'running' || item.status === 'paused');
          if (active) this.attach(active);
        },
        error: () => undefined,
      });
  }

  /** Muestra una ejecucion y sigue su avance si esta en marcha. */
  private attach(run: WorkflowRun): void {
    if (this.run()) return;

    this.run.set(run);
    this.selectedStageKey.set(run.currentStageKey ?? run.stages[0]?.key ?? null);
    // El selector de flujo debe coincidir con el flujo que se esta ejecutando.
    if (run.workflowId !== this.workflow()?.id) this.loadWorkflow(run.workflowId);
    if (run.status === 'running') this.startPolling();
  }

  // --- Carga -----------------------------------------------------------------

  protected reloadFlows(): Observable<Workflow[]> {
    return this.workflowsService.list();
  }

  protected loadWorkflow(workflowId: string): void {
    this.workflowsService
      .get(workflowId)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (workflow) => {
          this.workflow.set(workflow);
          this.selectedStageKey.set(null);
        },
        error: () => this.workflow.set(null),
      });
  }

  protected selectWorkflow(event: Event): void {
    const workflowId = (event.target as HTMLSelectElement).value;
    this.stopPolling();
    this.run.set(null);
    this.loadWorkflow(workflowId);
  }

  // --- Acciones sobre la ejecucion ------------------------------------------

  /** Inicia una demostracion: el backend devuelve el `runId` y sigue avanzando en segundo plano. */
  protected start(): void {
    const workflow = this.workflow();
    if (!workflow) return;

    this.busy.set(true);
    this.actionError.set(null);

    this.workflowsService
      .start(workflow.id)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (run) => {
          this.busy.set(false);
          this.run.set(run);
          this.selectedStageKey.set(run.stages[0]?.key ?? null);
          this.startPolling();
        },
        error: (error: { message: string }) => {
          this.busy.set(false);
          this.actionError.set(error.message);
        },
      });
  }

  protected pause(): void {
    this.control('pause');
  }

  protected resume(): void {
    this.control('resume');
  }

  protected reset(): void {
    this.control('reset');
  }

  private control(action: 'pause' | 'resume' | 'reset'): void {
    const run = this.run();
    if (!run) return;

    this.busy.set(true);
    this.actionError.set(null);

    const request =
      action === 'pause'
        ? this.workflowsService.pause(run.runId)
        : action === 'resume'
          ? this.workflowsService.resume(run.runId)
          : this.workflowsService.reset(run.runId);

    request.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.run.set(updated);
        // Reanudar y reiniciar vuelven a poner la ejecucion en marcha.
        if (updated.status === 'running') this.startPolling();
        else this.stopPolling();
      },
      error: (error: { message: string }) => {
        this.busy.set(false);
        this.actionError.set(error.message);
      },
    });
  }

  /**
   * Polling de la ejecucion. Se detiene al completar, al fallar, al pausar o al
   * destruirse la vista (seccion 14 del prompt).
   */
  private startPolling(): void {
    this.stopPolling();
    const intervalMs = this.health.simulation().pollIntervalMs;

    this.runPolling = interval(intervalMs)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const runId = this.run()?.runId;
        if (!runId) {
          this.stopPolling();
          return;
        }

        this.workflowsService
          .run(runId)
          .pipe(take(1))
          .subscribe({
            next: (updated) => {
              this.run.set(updated);
              if (updated.status !== 'running') this.stopPolling();
            },
            error: () => this.stopPolling(),
          });
      });
  }

  private stopPolling(): void {
    this.runPolling?.unsubscribe();
    this.runPolling = null;
  }

  // --- Puertas de decision ---------------------------------------------------

  protected onGateReasonInput(event: Event): void {
    this.gateReason.set((event.target as HTMLInputElement).value);
  }

  /** Aprueba la puerta: el flujo sigue por donde iba. */
  protected approveGate(): void {
    const run = this.run();
    if (!run || this.gateDeciding()) return;

    this.gateDeciding.set(true);
    this.gateError.set(null);

    this.workflowsService.approveGate(run.runId).subscribe({
      next: (updated) => {
        this.gateDeciding.set(false);
        this.gateReason.set('');
        this.run.set(updated);
        // Volver a seguir el avance: la ejecucion ya esta en marcha otra vez.
        if (updated.status === 'running') this.startPolling();
      },
      error: (error: { message: string }) => {
        this.gateDeciding.set(false);
        this.gateError.set(error.message);
      },
    });
  }

  /**
   * Rechaza la puerta: el ciclo se detiene aqui.
   * El motivo es opcional pero se guarda, y viaja hasta la oportunidad si la ejecucion
   * nacia de una: es la traza de por que se dijo que no.
   */
  protected rejectGate(): void {
    const run = this.run();
    if (!run || this.gateDeciding()) return;

    const reason = this.gateReason().trim();
    if (reason.length > 0 && reason.length < 3) {
      this.gateError.set('Si escribes un motivo, debe tener al menos 3 caracteres.');
      return;
    }

    this.gateDeciding.set(true);
    this.gateError.set(null);

    this.workflowsService.rejectGate(run.runId, reason || undefined).subscribe({
      next: (updated) => {
        this.gateDeciding.set(false);
        this.gateReason.set('');
        this.stopPolling();
        this.run.set(updated);
        this.gateOutcome.set(
          updated.discardedOpportunityId
            ? `Ciclo detenido. La oportunidad ${updated.discardedOpportunityId} queda descartada con tu motivo.`
            : 'Ciclo detenido en la puerta que rechazaste.',
        );
      },
      error: (error: { message: string }) => {
        this.gateDeciding.set(false);
        this.gateError.set(error.message);
      },
    });
  }

  // --- Normalizacion de etapas ----------------------------------------------

  private fromRun(stage: RunStage): StageView {
    return {
      key: stage.key,
      order: stage.order,
      name: stage.name,
      spanishName: this.stageLabel(stage.key),
      summary: stage.summary,
      description: stage.description,
      inputs: stage.inputs,
      deliverables: stage.deliverables,
      dependsOn: stage.dependsOn,
      department: stage.department,
      agents: stage.agents,
      gate: stage.gate,
      estimatedMinutes: stage.estimatedMinutes,
      status: stage.status,
      progress: stage.progress,
      startedAt: stage.startedAt,
      finishedAt: stage.finishedAt,
      durationMs: stage.durationMs,
      result: stage.result,
      error: stage.error,
      planned: false,
    };
  }

  private fromWorkflow(stage: WorkflowStage): StageView {
    return {
      key: stage.key,
      order: stage.order,
      name: stage.name,
      spanishName: this.stageLabel(stage.key),
      summary: stage.summary,
      description: stage.description,
      inputs: stage.inputs,
      deliverables: stage.deliverables,
      dependsOn: stage.dependsOn,
      department: stage.department,
      agents: stage.agents,
      gate: stage.gate,
      estimatedMinutes: stage.estimatedMinutes,
      status: 'pending',
      progress: 0,
      startedAt: null,
      finishedAt: null,
      durationMs: 0,
      result: stage.expectedOutcome,
      error: null,
      planned: true,
    };
  }

  /** Etapas a pintar: las de la ejecucion si existe, si no las de la plantilla. */
  protected readonly displayStages = computed<StageView[]>(() => {
    const run = this.run();
    if (run) return run.stages.map((stage) => this.fromRun(stage));

    return (this.workflow()?.stages ?? []).map((stage) => this.fromWorkflow(stage));
  });

  protected readonly selectedStageView = computed<StageView | null>(() => {
    const stages = this.displayStages();
    const key = this.selectedStageKey();
    if (!stages.length) return null;

    return stages.find((stage) => stage.key === key) ?? stages[0];
  });

  protected readonly hasRun = computed(() => this.run() !== null);
  protected readonly plannedCount = computed(() => this.workflow()?.stageCount ?? 0);
  protected readonly events = computed(() => this.run()?.events.slice(0, 12) ?? []);

  protected readonly runStatusLabel = computed(() =>
    this.run() ? labelOf(RUN_STATUS_LABEL, this.run()?.status) : 'Sin ejecucion',
  );

  protected readonly completionRate = computed(() => {
    const summary = this.run()?.summary;
    if (!summary || summary.totalStages === 0) return 0;
    return summary.completed / summary.totalStages;
  });

  // --- Presentacion ---------------------------------------------------------

  protected stageLabel(key: string): string {
    return labelOf(STAGE_LABEL_OVERRIDE, key, key);
  }

  protected dependencyLabel(key: string): string {
    return this.stageLabel(key);
  }

  /**
   * Dependencias de una etapa que aun no han terminado.
   * Se nombran en la interfaz en lugar de mostrar un "bloqueada" generico: saber A
   * QUIEN se esta esperando es lo unico util para supervisar el flujo.
   */
  protected blockingDependencies(stage: StageView): string[] {
    if (stage.status !== 'pending' || stage.planned) return [];

    const stages = this.displayStages();
    const byKey = new Map(stages.map((item) => [item.key, item]));

    return stage.dependsOn
      .filter((key) => byKey.has(key) && byKey.get(key)?.status !== 'completed')
      .map((key) => this.stageLabel(key));
  }

  /** Estado de una dependencia concreta, para el panel de detalle. */
  protected dependencyRef(key: string): { label: string; status: string } {
    const stages = this.displayStages();
    const dependency = stages.find((item) => item.key === key);
    return { label: this.stageLabel(key), status: dependency?.status ?? 'pending' };
  }

  protected stageColor(status: string): string {
    switch (status) {
      case 'completed':
        return '#5ce08a';
      case 'running':
        return '#4fd6ff';
      case 'failed':
        return '#d03b3b';
      case 'blocked':
        return '#ffc44d';
      case 'skipped':
        return '#566a7c';
      case 'working':
        return '#4fd6ff';
      case 'error':
        return '#d03b3b';
      default:
        return '#7a8fa3';
    }
  }

  /** Etapas del flujo que llevan puerta de decision, para marcarlas en la banda. */
  protected readonly gatedCount = computed(() => this.displayStages().filter((stage) => stage.gate).length);

  protected stageStatusLabel(status: string): string {
    return labelOf(STAGE_STATUS_LABEL, status);
  }

  protected severityOf(eventType: string): 'info' | 'success' | 'warning' | 'error' {
    if (eventType.includes('failed')) return 'error';
    if (eventType.includes('completed')) return 'success';
    if (eventType.includes('paused')) return 'warning';
    return 'info';
  }

  /** Ruta del CMS donde se puede consultar el artefacto que produce una etapa. */
  protected routeForArtifact(type: string): string {
    return ARTIFACT_ROUTES[type] ?? '/dashboard';
  }

  // --- Dependencias dibujadas ----------------------------------------------

  /** Posicion horizontal del centro de cada etapa dentro de la banda. */
  private nodeCenter(index: number): number {
    return FLOW_PADDING_LEFT + index * (NODE_WIDTH + NODE_GAP) + NODE_WIDTH / 2;
  }

  protected readonly flowWidth = computed(() => {
    const count = this.displayStages().length;
    return FLOW_PADDING_LEFT * 2 + count * NODE_WIDTH + Math.max(0, count - 1) * NODE_GAP;
  });

  /**
   * Lineas de dependencia: rectas para las etapas consecutivas y curvas discontinuas
   * para las que se saltan etapas, dibujadas por debajo para no tapar los nodos.
   */
  private readonly dependencyLines = computed<DependencyLine[]>(() => {
    const stages = this.displayStages();
    const indexByKey = new Map(stages.map((stage, index) => [stage.key, index]));
    const lines: DependencyLine[] = [];

    stages.forEach((stage, index) => {
      for (const dependency of stage.dependsOn) {
        const from = indexByKey.get(dependency);
        if (from === undefined) continue;

        const fromX = this.nodeCenter(from);
        const toX = this.nodeCenter(index);
        const key = `${dependency}->${stage.key}`;

        if (index - from === 1) {
          lines.push({
            key,
            d: `M${fromX + NODE_WIDTH / 2} ${TRACK_Y} L${toX - NODE_WIDTH / 2} ${TRACK_Y}`,
            dashed: false,
          });
          continue;
        }

        lines.push({
          key,
          d: `M${fromX} ${TRACK_Y} L${fromX} ${DEPENDENCY_Y} L${toX} ${DEPENDENCY_Y} L${toX} ${TRACK_Y}`,
          dashed: true,
        });
      }
    });

    return lines;
  });

  protected readonly adjacentLines = computed(() => this.dependencyLines().filter((line) => !line.dashed));
  protected readonly jumpLines = computed(() => this.dependencyLines().filter((line) => line.dashed));
}
