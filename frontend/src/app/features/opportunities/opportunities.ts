/**
 * Oportunidades: la cola del intake.
 *
 * Esta vista es donde el operador decide. Yanca (y el estudio de fuentes) propone; aqui
 * se ve que ha encontrado, con que evidencia, que falta por saber y en que estado esta
 * cada una. Aprobar es lo que habilita una oportunidad para entrar al flujo.
 *
 * Dos decisiones de diseno visibles en la interfaz:
 *  - La puntuacion se muestra siempre junto a su **cobertura** y a los datos que
 *    faltan: un 75 con media docena de metricas no es lo mismo que un 75 con dos.
 *  - Cada cifra muestra **su fuente y su modo** (`live` o `simulated`), asi que un dato
 *    de demostracion nunca puede pasar por dato de mercado.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import type { ApiMeta } from '../../core/models/api.model';
import {
  type DataSourceInfo,
  type DiscoverResult,
  type Opportunity,
  type OpportunityStatus,
  type OpportunitySummary,
  type ScanCandidate,
  type ScanResult,
} from '../../core/models/opportunities.model';
import { OPPORTUNITY_STATUS_LABEL, labelOf } from '../../core/models/labels';
import { OpportunitiesService } from '../../core/services/opportunities.service';
import { AsyncState } from '../../core/util/async-state';
import { BarChart } from '../../shared/components/bar-chart/bar-chart';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { ProgressBar } from '../../shared/components/progress-bar/progress-bar';
import { StatTile } from '../../shared/components/stat-tile/stat-tile';
import { StateDisplay } from '../../shared/components/state-display/state-display';
import { StatusChip } from '../../shared/components/status-chip/status-chip';
import { EuroPipe, NumberEsPipe, PercentPipe, TimeAgoPipe } from '../../shared/pipes/format.pipes';

/** Cola ya paginada, lista para la plantilla. */
interface QueuePage {
  items: Opportunity[];
  meta: ApiMeta;
}

const STATUS_ORDER: OpportunityStatus[] = ['candidate', 'approved', 'discarded'];
const SORTS = ['score', 'recent', 'coverage', 'keyword', 'status'] as const;

@Component({
  selector: 'app-opportunities-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    BarChart,
    PixelIcon,
    ProgressBar,
    StatTile,
    StateDisplay,
    StatusChip,
    EuroPipe,
    NumberEsPipe,
    PercentPipe,
    TimeAgoPipe,
  ],
  templateUrl: './opportunities.html',
  styles: [
    `
      .terms-input {
        min-height: 62px;
        resize: vertical;
        font-family: var(--px-font-mono);
        font-size: 12px;
      }

      .queue-row {
        cursor: pointer;
      }

      .queue-row--active {
        background: var(--px-surface-3);
        box-shadow: inset 3px 0 0 0 var(--px-amber);
      }

      .component-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 96px 76px;
        gap: 8px;
        align-items: center;
        padding: 7px 0;
        border-bottom: 1px solid var(--px-line);
      }

      .component-row:last-child {
        border-bottom: 0;
      }

      .component-source {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
        font-size: 10.5px;
        color: var(--px-ink-muted);
      }

      .rising-term {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 5px 0;
        border-bottom: 1px solid var(--px-line);
      }

      .rising-term:last-child {
        border-bottom: 0;
      }

      .decision-box {
        padding: 10px;
        background: var(--px-surface-1);
        border: 2px solid var(--px-line);
      }
    `,
  ],
})
export class OpportunitiesPage {
  private readonly opportunities = inject(OpportunitiesService);
  private readonly router = inject(Router);

  protected readonly queue = new AsyncState<QueuePage>();
  protected readonly summary = new AsyncState<OpportunitySummary>();
  protected readonly detail = new AsyncState<Opportunity>();

  protected readonly selectedId = signal<string | null>(null);
  protected readonly statusFilter = signal<OpportunityStatus | ''>('');
  protected readonly sort = signal<(typeof SORTS)[number]>('score');
  protected readonly search = signal('');

  /** Formulario del estudio. */
  protected readonly scanOpen = signal(false);
  protected readonly termsInput = signal('perforadora de escritorio, soporte de portatil');
  protected readonly minMargin = signal(25);
  protected readonly maxCost = signal<number | null>(null);
  protected readonly maxCompetition = signal<number | null>(null);
  protected readonly mode = signal<'auto' | 'live' | 'simulated'>('auto');
  protected readonly scanning = signal(false);
  protected readonly scanResult = signal<ScanResult | null>(null);
  protected readonly scanError = signal<string | null>(null);

  /** Descubrimiento de terminos que suben. */
  protected readonly discovering = signal(false);
  protected readonly discoverResult = signal<DiscoverResult | null>(null);
  protected readonly discoverError = signal<string | null>(null);

  /** Fuentes de datos y su estado, para no perder de vista con que se trabaja. */
  protected readonly sourcesState = new AsyncState<{ mode: string; sources: DataSourceInfo[] }>();

  /** Decision pendiente sobre la oportunidad seleccionada. */
  protected readonly decisionReason = signal('');
  protected readonly deciding = signal(false);
  protected readonly decisionError = signal<string | null>(null);

  /** Lanzamiento del flujo atado a la oportunidad aprobada. */
  protected readonly launching = signal(false);
  protected readonly launchError = signal<string | null>(null);

  protected readonly statuses = STATUS_ORDER;
  protected readonly statusLabel = OPPORTUNITY_STATUS_LABEL;
  protected readonly sortOptions = SORTS;

  protected readonly selected = computed(() => this.detail.data());
  protected readonly candidates = computed(() => this.scanResult()?.candidates ?? []);

  /** Fuentes reales configuradas: si son cero, todo lo que se vea sera de demostracion. */
  protected readonly liveSources = computed(
    () => (this.sourcesState.data()?.sources ?? []).filter((source) => source.mode === 'live' && source.available).length,
  );
  protected readonly sourceMode = computed(() => this.sourcesState.data()?.mode ?? 'auto');

  /** Reparto por cobertura: cuantas van con el estudio completo. */
  protected readonly coverageRows = computed(() => {
    const data = this.summary.data();
    if (!data) return [];

    return [
      { label: 'Estudio completo', value: data.byCoverage.complete },
      { label: 'Datos parciales', value: data.byCoverage.partial },
      { label: 'Sin datos', value: data.byCoverage.withoutData },
    ];
  });

  constructor() {
    this.load();
    this.sourcesState.load(() => this.opportunities.sources());
  }

  protected load(): void {
    this.queue.load(() =>
      this.opportunities
        .list({
          status: this.statusFilter() || undefined,
          sort: this.sort(),
          search: this.search() || undefined,
          pageSize: 50,
        })
        .pipe(map((response) => ({ items: response.data, meta: response.meta }))),
    );
    this.summary.load(() => this.opportunities.summary());

    const current = this.selectedId();
    if (current) this.select(current);
  }

  protected refreshQueue(): void {
    this.queue.load(
      () =>
        this.opportunities
          .list({
            status: this.statusFilter() || undefined,
            sort: this.sort(),
            search: this.search() || undefined,
            pageSize: 50,
          })
          .pipe(map((response) => ({ items: response.data, meta: response.meta }))),
      { keepData: true },
    );
    this.summary.load(() => this.opportunities.summary(), { keepData: true });
  }

  protected onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as OpportunityStatus | '');
    this.refreshQueue();
  }

  protected onSortChange(event: Event): void {
    this.sort.set((event.target as HTMLSelectElement).value as (typeof SORTS)[number]);
    this.refreshQueue();
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected applySearch(): void {
    this.refreshQueue();
  }

  protected select(opportunityId: string): void {
    this.selectedId.set(opportunityId);
    this.decisionReason.set('');
    this.decisionError.set(null);
    this.detail.load(() => this.opportunities.get(opportunityId));
  }

  protected closeDetail(): void {
    this.selectedId.set(null);
    this.detail.reset();
  }

  // --- Estudio --------------------------------------------------------------

  protected toggleScan(): void {
    this.scanOpen.update((open) => !open);
  }

  protected onTermsInput(event: Event): void {
    this.termsInput.set((event.target as HTMLTextAreaElement).value);
  }

  protected onNumberInput(target: 'minMargin' | 'maxCost' | 'maxCompetition', event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const value = raw === '' ? null : Number(raw);

    if (target === 'minMargin') this.minMargin.set(value ?? 0);
    if (target === 'maxCost') this.maxCost.set(value);
    if (target === 'maxCompetition') this.maxCompetition.set(value);
  }

  protected onModeChange(event: Event): void {
    this.mode.set((event.target as HTMLSelectElement).value as 'auto' | 'live' | 'simulated');
  }

  /** Terminos del formulario, sin repetir y sin vacios. */
  protected readonly parsedTerms = computed(() =>
    [...new Set(this.termsInput().split(/[,\n]/).map((term) => term.trim()).filter(Boolean))],
  );

  protected runScan(): void {
    const keywords = this.parsedTerms();
    if (keywords.length === 0 || this.scanning()) return;

    this.scanning.set(true);
    this.scanError.set(null);

    this.opportunities
      .scan({
        keywords,
        mode: this.mode(),
        constraints: {
          minMargin: this.minMargin() / 100,
          maxCost: this.maxCost(),
          maxCompetition: this.maxCompetition(),
        },
      })
      .subscribe({
        next: (result) => {
          this.scanning.set(false);
          this.scanResult.set(result);
          this.refreshQueue();
        },
        error: (error: { message: string }) => {
          this.scanning.set(false);
          this.scanError.set(error.message);
        },
      });
  }

  /** Carga los terminos que estan subiendo y los propone como candidatos a estudiar. */
  protected discoverRising(): void {
    if (this.discovering()) return;

    this.discovering.set(true);
    this.opportunities.discover(undefined, 10).subscribe({
      next: (result) => {
        this.discovering.set(false);
        this.discoverResult.set(result);
      },
      error: (error: { message: string }) => {
        this.discovering.set(false);
        this.discoverError.set(error.message);
      },
    });
  }

  /** Pasa los terminos descubiertos al formulario del estudio. */
  protected useRisingTerms(): void {
    const terms = this.discoverResult()?.terms ?? [];
    if (terms.length === 0) return;

    this.termsInput.set(terms.map((term) => term.title).join(', '));
    this.scanOpen.set(true);
  }

  // --- Decision -------------------------------------------------------------

  protected onReasonInput(event: Event): void {
    this.decisionReason.set((event.target as HTMLInputElement).value);
  }

  protected decide(action: 'approve' | 'discard'): void {
    const opportunity = this.selected();
    if (!opportunity || this.deciding()) return;

    this.deciding.set(true);
    this.decisionError.set(null);

    const request =
      action === 'approve'
        ? this.opportunities.approve(opportunity.id, this.decisionReason() || undefined)
        : this.opportunities.discard(opportunity.id, this.decisionReason() || undefined);

    request.subscribe({
      next: (updated) => {
        this.deciding.set(false);
        this.detail.set(updated);
        this.decisionReason.set('');
        this.refreshQueue();
      },
      error: (error: { message: string }) => {
        this.deciding.set(false);
        this.decisionError.set(error.message);
      },
    });
  }

  // --- Presentacion ---------------------------------------------------------

  protected statusText(status: OpportunityStatus): string {
    return labelOf(OPPORTUNITY_STATUS_LABEL, status);
  }

  /**
   * Lanza el flujo con esta oportunidad y va al flujo a seguir su avance.
   *
   * Solo funciona con oportunidades aprobadas: el backend lo comprueba y responde 409
   * si no lo estan, asi que la aprobacion es el paso que habilita de verdad.
   */
  protected launchFlow(): void {
    const opportunity = this.selected();
    if (!opportunity || this.launching()) return;

    this.launching.set(true);
    this.launchError.set(null);

    this.opportunities.launch(opportunity.id).subscribe({
      next: (run) => {
        this.launching.set(false);
        // El flujo se reengancha solo a la ejecucion en curso al abrirse.
        void this.router.navigate(['/workflows'], { queryParams: { run: run.runId } });
      },
      error: (error: { message: string }) => {
        this.launching.set(false);
        this.launchError.set(error.message);
      },
    });
  }

  protected scoreColor(score: number | null): string {
    if (score === null) return '#7a8fa3';
    if (score >= 75) return '#5ce08a';
    if (score >= 55) return '#ffc44d';
    return '#ff8f4d';
  }

  protected verdictTone(verdict: string): string {
    if (verdict === 'cumple') return 'chip--good';
    if (verdict === 'no cumple') return 'chip--critical';
    return 'chip--warning';
  }

  protected sourceTone(mode: string): string {
    return mode === 'live' ? 'chip--info' : 'chip--warning';
  }

  protected modeText(mode: string): string {
    return mode === 'live' ? 'dato real' : 'demostracion';
  }

  protected candidateOf(keyword: string): ScanCandidate | undefined {
    return this.candidates().find((candidate) => candidate.keyword === keyword);
  }
}
