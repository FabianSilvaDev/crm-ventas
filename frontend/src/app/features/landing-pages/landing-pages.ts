/**
 * Landing pages: catalogo, salud tecnica y experimentos de conversion.
 *
 * Tres fuentes de datos independientes: el listado filtrable (`GET /landing-pages`),
 * el detalle de la landing seleccionada (`GET /landing-pages/:id`) y el resumen con
 * experimentos y paginas pendientes (`GET /landing-pages/summary`).
 *
 * Los umbrales de salud tecnica que la vista marca en color se declaran aqui como
 * constantes y se escriben en pantalla: el color acompana al dato, nunca lo sustituye.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import type { LandingPage } from '../../core/models/catalog.model';
import { CHANNEL_LABEL, LANDING_STATUS_LABEL, labelOf } from '../../core/models/labels';
import { LandingPagesService, type LandingQuery, type LandingSummary } from '../../core/services/landing-pages.service';
import { AsyncState } from '../../core/util/async-state';
import { AgentAvatarView } from '../../shared/components/agent-avatar/agent-avatar';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { ProgressBar } from '../../shared/components/progress-bar/progress-bar';
import { StatTile } from '../../shared/components/stat-tile/stat-tile';
import { StateDisplay } from '../../shared/components/state-display/state-display';
import { StatusChip } from '../../shared/components/status-chip/status-chip';
import {
  CompactNumberPipe,
  DateEsPipe,
  DurationPipe,
  EuroPipe,
  NumberEsPipe,
  PercentPipe,
  TimeAgoPipe,
} from '../../shared/pipes/format.pipes';

/** Ordenes admitidos por el listado de landings. */
type LandingSort = 'visitors' | 'conversionRate' | 'seo' | 'recent' | 'title';

interface LandingsView {
  items: LandingPage[];
  total: number;
}

/** Opcion de un desplegable de filtro. */
interface FilterOption {
  value: string;
  label: string;
}

/**
 * Umbrales de salud tecnica que la vista hace explicitos junto a cada cifra.
 * LCP: Core Web Vitals considera bueno hasta 1,8 s y pobre a partir de 2,5 s.
 */
const LCP_GOOD_MS = 1800;
const LCP_WARN_MS = 2500;
/** Puntuaciones de SEO y de movilidad sobre 100. */
const SCORE_GOOD = 85;
const SCORE_WARN = 70;

const LANDING_SORTS: { value: LandingSort; label: string }[] = [
  { value: 'visitors', label: 'Mas visitantes' },
  { value: 'conversionRate', label: 'Mejor conversion' },
  { value: 'seo', label: 'Mejor SEO' },
  { value: 'recent', label: 'Actualizadas recientemente' },
  { value: 'title', label: 'Titulo (A-Z)' },
];

const LANDING_STATUS_OPTIONS: FilterOption[] = Object.entries(LANDING_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));

/** Valor de un control de formulario, ya estrechado a texto. */
const inputValue = (event: Event): string => (event.target as HTMLInputElement | HTMLSelectElement).value;

@Component({
  selector: 'app-landing-pages-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AgentAvatarView,
    PixelIcon,
    ProgressBar,
    StatTile,
    StateDisplay,
    StatusChip,
    CompactNumberPipe,
    DateEsPipe,
    DurationPipe,
    EuroPipe,
    NumberEsPipe,
    PercentPipe,
    TimeAgoPipe,
  ],
  templateUrl: './landing-pages.html',
  styles: [
    `
      /* Ficha de landing: el panel marca en su borde cual esta seleccionada. */
      .landing-card {
        display: flex;
        flex-direction: column;
      }

      /* El pie queda abajo aunque las fichas de la fila tengan alturas distintas. */
      .landing-card .panel__body {
        flex: 1 1 auto;
      }

      .landing-card--selected {
        border-color: var(--px-cyan);
        box-shadow: 0 0 0 2px rgba(79, 214, 255, 0.22), var(--px-shadow);
      }

      .landing-card__title {
        font-size: 13px;
        font-weight: 600;
        min-width: 0;
      }

      /* Nota secundaria de una celda o ficha: va siempre en su propia linea. */
      .cell-note {
        display: block;
      }

      /* El encabezado de fila lleva nombres, no etiquetas: se lee como texto normal. */
      .table th[scope='row'] {
        font-family: var(--px-font-ui);
        font-size: 12.5px;
        font-weight: 500;
        letter-spacing: 0;
        text-transform: none;
        color: var(--px-ink);
        white-space: normal;
      }
    `,
  ],
})
export class LandingPagesPage {
  private readonly landingPagesService = inject(LandingPagesService);

  protected readonly summaryState = new AsyncState<LandingSummary>();
  protected readonly listState = new AsyncState<LandingsView>();
  protected readonly detailState = new AsyncState<LandingPage>();

  /** Filtros vigentes del listado. */
  protected readonly status = signal('');
  protected readonly search = signal('');
  protected readonly sort = signal<LandingSort>('visitors');

  /** Landing cuyo detalle se muestra. */
  protected readonly selectedId = signal<string | null>(null);

  /** Fecha de referencia de la demo, publicada por la API en `meta`. */
  protected readonly referenceDate = signal<string | null>(null);

  protected readonly statusOptions = LANDING_STATUS_OPTIONS;
  protected readonly sorts = LANDING_SORTS;

  /** Umbrales escritos en pantalla, para que el color no sea el unico canal. */
  protected readonly lcpGoodMs = LCP_GOOD_MS;
  protected readonly lcpWarnMs = LCP_WARN_MS;
  protected readonly scoreGood = SCORE_GOOD;

  constructor() {
    this.loadSummary();
    this.loadList(false);
  }

  // --- Carga de datos -------------------------------------------------------

  protected loadSummary(): void {
    this.summaryState.load(() => this.landingPagesService.summary());
  }

  /** Recarga el listado con los filtros vigentes; `keepData` evita el parpadeo. */
  protected loadList(keepData = true): void {
    const query: LandingQuery = {
      status: this.status(),
      search: this.search(),
      sort: this.sort(),
    };

    this.listState.load(
      () =>
        this.landingPagesService.list(query).pipe(
          map((response) => {
            this.referenceDate.set(response.meta.demoReferenceDate ?? null);
            this.syncSelection(response.data);
            return { items: response.data, total: response.meta.total ?? response.data.length };
          }),
        ),
      { keepData },
    );
  }

  /** Carga el detalle de la landing indicada. */
  private loadDetail(id: string): void {
    this.detailState.load(() => this.landingPagesService.get(id));
  }

  /**
   * Mantiene una seleccion valida: si la landing elegida desaparece con el filtro
   * aplicado, se pasa a la primera de la lista para que el detalle no quede huerfano.
   */
  private syncSelection(items: LandingPage[]): void {
    const current = this.selectedId();
    if (items.some((page) => page.id === current)) return;
    this.selectLanding(items[0]?.id ?? null);
  }

  protected selectLanding(id: string | null): void {
    if (id === null) {
      this.selectedId.set(null);
      this.detailState.reset();
      return;
    }

    if (id === this.selectedId() && this.detailState.data()) return;
    this.selectedId.set(id);
    this.loadDetail(id);
  }

  protected reloadDetail(): void {
    const id = this.selectedId();
    if (id) this.loadDetail(id);
  }

  protected refreshAll(): void {
    this.loadSummary();
    this.loadList();
    this.reloadDetail();
  }

  // --- Filtros --------------------------------------------------------------

  protected onStatus(event: Event): void {
    this.status.set(inputValue(event));
    this.loadList();
  }

  protected onSearch(event: Event): void {
    this.search.set(inputValue(event));
    this.loadList();
  }

  protected onSort(event: Event): void {
    this.sort.set(inputValue(event) as LandingSort);
    this.loadList();
  }

  // --- Datos ya resueltos ---------------------------------------------------

  protected readonly totals = computed(() => this.summaryState.data()?.totals ?? null);
  protected readonly technical = computed(() => this.summaryState.data()?.technical ?? null);
  protected readonly experiments = computed(() => this.summaryState.data()?.experiments ?? []);
  protected readonly pendingWork = computed(() => this.summaryState.data()?.technical.pagesNeedingWork ?? []);
  protected readonly landings = computed(() => this.listState.data()?.items ?? []);
  protected readonly landingTotal = computed(() => this.listState.data()?.total ?? 0);
  protected readonly detail = computed(() => this.detailState.data());

  /** Variante ganadora del experimento, segun el detalle o el campo `winner` de la landing. */
  protected readonly winnerId = computed(
    () => this.detail()?.experiment?.winner.id ?? this.detail()?.winner?.id ?? null,
  );

  protected readonly hasActiveFilters = computed(
    () => this.status() !== '' || this.search() !== '',
  );

  // --- Utilidades de plantilla ----------------------------------------------

  /** Tono de texto segun el LCP medido, con los umbrales declarados arriba. */
  protected lcpTone(lcpMs: number): string {
    if (lcpMs <= 0) return 'text-dim';
    if (lcpMs <= LCP_GOOD_MS) return 'text-good';
    if (lcpMs <= LCP_WARN_MS) return 'text-warn';
    return 'text-bad';
  }

  /** Tono de texto de una puntuacion sobre 100 (SEO o movilidad). */
  protected scoreTone(score: number): string {
    if (score >= SCORE_GOOD) return 'text-good';
    if (score >= SCORE_WARN) return 'text-warn';
    return 'text-bad';
  }

  /** Color de la barra de progreso, coherente con el tono del texto. */
  protected scoreColor(score: number): string {
    if (score >= SCORE_GOOD) return '#5ce08a';
    if (score >= SCORE_WARN) return '#ffc44d';
    return '#d03b3b';
  }

  protected channelList(channels: string[]): string {
    return channels.map((channel) => labelOf(CHANNEL_LABEL, channel)).join(' · ');
  }

  /** Accion pendiente sugerida para una landing que no alcanza los umbrales. */
  protected pendingAction(seoScore: number, lcpMs: number): string {
    const actions: string[] = [];
    if (seoScore < SCORE_GOOD) actions.push(`revisar SEO (${seoScore} < ${SCORE_GOOD})`);
    if (lcpMs > LCP_GOOD_MS && lcpMs > 0) actions.push(`optimizar carga (${lcpMs} ms > ${LCP_GOOD_MS} ms)`);
    return actions.length > 0 ? actions.join(' y ') : 'sin acciones pendientes';
  }
}
