/**
 * Investigacion de mercado: informes, hallazgos y fuentes.
 *
 * El listado (`GET /research`) solo trae la cabecera de cada informe; los hallazgos,
 * las fuentes, los competidores y la serie llegan en el detalle
 * (`GET /research/:id`), que se carga al seleccionar una tarjeta.
 *
 * Los agregados de cabecera vienen de `GET /research/summary`.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { forkJoin, map, tap } from 'rxjs';
import type { ResearchReport } from '../../core/models/catalog.model';
import { RESEARCH_TYPE_LABEL, labelOf } from '../../core/models/labels';
import { ResearchService, type ResearchQuery, type ResearchSummary } from '../../core/services/research.service';
import { AsyncState } from '../../core/util/async-state';
import { AgentAvatarView } from '../../shared/components/agent-avatar/agent-avatar';
import { BarChart, type BarRow } from '../../shared/components/bar-chart/bar-chart';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { StatTile } from '../../shared/components/stat-tile/stat-tile';
import { StateDisplay } from '../../shared/components/state-display/state-display';
import { StatusChip } from '../../shared/components/status-chip/status-chip';
import { DateEsPipe, EuroPipe, NumberEsPipe, TimeAgoPipe } from '../../shared/pipes/format.pipes';

type ResearchSort = NonNullable<ResearchQuery['sort']>;
type ResearchStatus = ResearchReport['status'];

/** Orden admitido por `GET /research?sort=`, con su etiqueta en espanol. */
const SORT_OPTIONS: { value: ResearchSort; label: string }[] = [
  { value: 'recent', label: 'Mas recientes' },
  { value: 'title', label: 'Titulo' },
  { value: 'type', label: 'Tipo' },
];

/**
 * Estados que admite `GET /research?status=`.
 * El listado solo publica los tipos en `meta.filters`, asi que las dos opciones de
 * estado se declaran aqui con su etiqueta.
 */
const STATUS_OPTIONS: { value: ResearchStatus; label: string }[] = [
  { value: 'published', label: 'Publicado' },
  { value: 'draft', label: 'Borrador' },
];

/** Todo lo que necesita la vista, resuelto en una sola carga. */
interface ResearchView {
  reports: ResearchReport[];
  total: number;
  referenceDate: string | null;
  summary: ResearchSummary;
  /** Tipos que acepta el filtro, tal como los publica la API en `meta.filters`. */
  types: string[];
}

@Component({
  selector: 'app-research-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AgentAvatarView,
    BarChart,
    PixelIcon,
    StatTile,
    StateDisplay,
    StatusChip,
    DateEsPipe,
    EuroPipe,
    NumberEsPipe,
    TimeAgoPipe,
  ],
  templateUrl: './research.html',
  styles: [
    `
      /* Tarjeta-informe: toda la tarjeta es el boton que abre el detalle. */
      .report-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: var(--px-surface-2);
        border: 2px solid var(--px-line);
        box-shadow: var(--px-inset-light), var(--px-shadow-sm);
        text-align: left;
        color: inherit;
        cursor: pointer;
      }

      .report-card:hover {
        border-color: var(--px-line-strong);
      }

      /* Marca visual del informe abierto; el detalle se muestra al lado. */
      .report-card--selected {
        border-color: var(--px-cyan);
        box-shadow: 0 0 0 2px var(--px-cyan), var(--px-inset-light), var(--px-shadow-sm);
      }

      .report-card__title {
        font-family: var(--px-font-mono);
        font-size: 12.5px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .report-card__summary {
        font-size: 11.5px;
        color: var(--px-ink-muted);
      }

      .report__meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 10.5px;
        color: var(--px-ink-muted);
      }

      .report__author {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }
    `,
  ],
})
export class ResearchPage {
  private readonly research = inject(ResearchService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = new AsyncState<ResearchView>();
  /** Detalle del informe abierto: hallazgos, fuentes, competidores y serie. */
  protected readonly detail = new AsyncState<ResearchReport>();

  // --- Filtros ----------------------------------------------------------------

  protected readonly search = signal('');
  protected readonly type = signal('');
  protected readonly status = signal<ResearchStatus | ''>('');
  protected readonly sort = signal<ResearchSort>('recent');

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly statusOptions = STATUS_OPTIONS;

  protected readonly selectedId = signal<string | null>(null);

  /** Temporizador del buscador: evita una peticion por cada tecla. */
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
    this.destroyRef.onDestroy(() => this.clearSearchTimer());
  }

  // --- Carga ------------------------------------------------------------------

  /** Peticion de la vista: listado filtrado y agregados de la cabecera. */
  private source() {
    return forkJoin({
      reports: this.research.list({
        type: this.type() || undefined,
        status: this.status() || undefined,
        search: this.search().trim() || undefined,
        sort: this.sort(),
      }),
      summary: this.research.summary(),
    }).pipe(
      map(({ reports, summary }) => {
        const filters = (reports.meta['filters'] ?? {}) as { types?: string[] };

        return {
          reports: reports.data,
          total: reports.meta.total ?? reports.data.length,
          referenceDate: reports.meta.demoReferenceDate ?? null,
          summary,
          types: filters.types ?? [],
        };
      }),
      // El panel de detalle nunca queda vacio: abre el primer informe del listado.
      tap((view) => this.syncSelection(view.reports)),
    );
  }

  protected load(): void {
    this.state.load(() => this.source());
  }

  /** Recarga conservando los datos en pantalla, para que los filtros no parpadeen. */
  private reload(): void {
    this.state.load(() => this.source(), { keepData: true });
  }

  protected refresh(): void {
    this.reload();
  }

  /** Abre un informe en el panel de detalle y pide su contenido ampliado. */
  protected selectReport(reportId: string): void {
    this.selectedId.set(reportId);
    this.detail.load(() => this.research.get(reportId));
  }

  /** Mantiene abierto un informe que siga estando en el listado; si no, usa el primero. */
  private syncSelection(reports: ResearchReport[]): void {
    const current = this.selectedId();
    if (current && reports.some((report) => report.id === current)) return;

    const first = reports[0];
    if (first) {
      this.selectReport(first.id);
      return;
    }

    this.selectedId.set(null);
    this.detail.reset();
  }

  protected reloadDetail(): void {
    const reportId = this.selectedId();
    if (reportId) this.selectReport(reportId);
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

  protected onTypeChange(value: string): void {
    this.type.set(value);
    this.reload();
  }

  protected onStatusChange(value: string): void {
    this.status.set(value === '' ? '' : (value as ResearchStatus));
    this.reload();
  }

  protected onSortChange(value: string): void {
    this.sort.set(value as ResearchSort);
    this.reload();
  }

  protected clearFilters(): void {
    this.clearSearchTimer();
    this.search.set('');
    this.type.set('');
    this.status.set('');
    this.sort.set('recent');
    this.reload();
  }

  protected readonly hasFilters = computed(
    () => this.search().trim() !== '' || this.type() !== '' || this.status() !== '' || this.sort() !== 'recent',
  );

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  // --- Datos derivados --------------------------------------------------------

  protected readonly reports = computed(() => this.state.data()?.reports ?? []);
  protected readonly total = computed(() => this.state.data()?.total ?? 0);
  protected readonly types = computed(() => this.state.data()?.types ?? []);
  protected readonly referenceDate = computed(() => this.state.data()?.referenceDate ?? null);
  protected readonly totals = computed(() => this.state.data()?.summary.totals ?? null);

  /** Informes pendientes de decision del operador, segun el resumen de la API. */
  protected readonly pendingValidation = computed(() => this.state.data()?.summary.pendingValidation.length ?? 0);

  /** Reparto por tipo: una sola medida por categoria, con el nombre como identidad. */
  protected readonly typeRows = computed<BarRow[]>(() =>
    (this.state.data()?.summary.byType ?? [])
      .map((row) => ({ label: labelOf(RESEARCH_TYPE_LABEL, row.type), value: row.count }))
      .sort((a, b) => b.value - a.value),
  );

  /** Serie del informe abierto, si la trae. */
  protected readonly seriesRows = computed<BarRow[]>(() =>
    (this.detail.data()?.series ?? []).map((point) => ({ label: point.label, value: point.value })),
  );

  protected typeLabel(type: string): string {
    return labelOf(RESEARCH_TYPE_LABEL, type);
  }
}
