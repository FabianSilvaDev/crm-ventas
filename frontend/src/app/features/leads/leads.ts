/**
 * Leads y ventas: embudo comercial, listado filtrado y detalle de cada oportunidad.
 *
 * Tres peticiones distintas alimentan la vista:
 *  - `GET /leads/summary`  -> cabecera de indicadores y embudo (recuentos por estado).
 *  - `GET /leads`          -> tabla filtrada y paginada (meta.page/total/totalPages).
 *  - `GET /leads/:id`      -> panel de detalle con la traza completa del lead.
 *
 * La vista no calcula cifras nuevas: del embudo solo deriva la tasa de paso entre
 * etapas consecutivas, y siempre a partir de los recuentos que devuelve la API.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import type { Lead, LeadStatus } from '../../core/models/catalog.model';
import type { FunnelStep } from '../../core/models/insights.model';
import { CHANNEL_LABEL, LEAD_STATUS_LABEL, OFFER_STATUS_LABEL, labelOf } from '../../core/models/labels';
import { LeadsService, type LeadQuery, type LeadsSummary } from '../../core/services/leads.service';
import { AsyncState } from '../../core/util/async-state';
import { AgentAvatarView } from '../../shared/components/agent-avatar/agent-avatar';
import { BarChart, type BarRow } from '../../shared/components/bar-chart/bar-chart';
import { FunnelChart } from '../../shared/components/funnel-chart/funnel-chart';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { StatTile } from '../../shared/components/stat-tile/stat-tile';
import { StateDisplay } from '../../shared/components/state-display/state-display';
import { StatusChip } from '../../shared/components/status-chip/status-chip';
import { EuroPipe, DateEsPipe, NumberEsPipe, PercentPipe, TimeAgoPipe } from '../../shared/pipes/format.pipes';

/** Claves de orden que acepta la API. */
type LeadSort = 'score' | 'value' | 'recent' | 'company';
/** Prioridades que acepta la API. */
type LeadPriority = 'alta' | 'media' | 'baja';

/** Etapas del embudo comercial, en el orden natural del proceso. */
const FUNNEL_ORDER: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposal', 'won'];

const SORT_OPTIONS: { value: LeadSort; label: string }[] = [
  { value: 'score', label: 'Puntuacion (mayor primero)' },
  { value: 'value', label: 'Valor (mayor primero)' },
  { value: 'recent', label: 'Mas recientes' },
  { value: 'company', label: 'Empresa (A-Z)' },
];

/** Prioridad como texto: la API devuelve la clave en minusculas. */
const PRIORITY_LABEL: Record<LeadPriority, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

/** Tono de la prioridad: nunca es el unico canal, siempre acompana al texto. */
const PRIORITY_TONE: Record<LeadPriority, string> = {
  alta: 'chip--warning',
  media: 'chip--info',
  baja: 'chip--neutral',
};

/**
 * Tipos de paso de la traza de un lead. `labels.ts` traduce los tipos de evento de
 * actividad, pero la traza usa sus propias claves (`created`, `qualified`, ...),
 * asi que se traducen aqui y se reutiliza el mapa comun para el resto.
 */
const TIMELINE_STEP_LABEL: Record<string, string> = {
  created: 'Lead captado',
  qualified: 'Cualificacion',
  contacted: 'Contacto',
  proposal: 'Propuesta',
  won: 'Cierre ganado',
  lost: 'Cierre perdido',
};

/** Severidad del marcador de cada paso de la traza. */
const TIMELINE_STEP_SEVERITY: Record<string, string> = {
  created: 'info',
  qualified: 'info',
  contacted: 'info',
  proposal: 'warning',
  won: 'success',
  lost: 'error',
};

/** Pagina del listado tal como la devuelve la API en `meta`. */
interface LeadsListPage {
  leads: Lead[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  referenceDate: string | null;
}

@Component({
  selector: 'app-leads-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AgentAvatarView,
    BarChart,
    FunnelChart,
    PixelIcon,
    StatTile,
    StateDisplay,
    StatusChip,
    EuroPipe,
    DateEsPipe,
    NumberEsPipe,
    PercentPipe,
    TimeAgoPipe,
  ],
  templateUrl: './leads.html',
  styles: [
    `
      .lead-row {
        cursor: pointer;
      }

      .lead-row--active {
        background: var(--px-surface-3);
        box-shadow: inset 3px 0 0 0 var(--px-cyan);
      }

      .detail-head {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      /* Tarjeta de oportunidad: misma rejilla que el feed, pero es un boton. */
      .lead-card {
        width: 100%;
        background: none;
        border: 0;
        border-bottom: 1px solid var(--px-line);
        text-align: left;
        cursor: pointer;
        color: inherit;
      }

      .lead-card:hover {
        background: var(--px-surface-3);
      }
    `,
  ],
})
export class LeadsPage {
  private readonly leadsService = inject(LeadsService);

  /** Recuentos del embudo: cabecera y grafico. */
  protected readonly summaryState = new AsyncState<LeadsSummary>();
  /** Pagina actual del listado, con la paginacion que publica `meta`. */
  protected readonly listState = new AsyncState<LeadsListPage>();
  /** Lead seleccionado, con su traza. */
  protected readonly detailState = new AsyncState<Lead>();

  // --- Filtros ------------------------------------------------------------------

  /** Texto que se esta escribiendo en el buscador (aun sin aplicar). */
  protected readonly searchDraft = signal('');
  protected readonly search = signal('');
  protected readonly status = signal<LeadStatus | ''>('');
  protected readonly origin = signal('');
  protected readonly priority = signal<LeadPriority | ''>('');
  protected readonly minScore = signal<number | null>(null);
  protected readonly sort = signal<LeadSort>('score');
  protected readonly page = signal(1);
  protected readonly pageSize = 10;
  protected readonly selectedId = signal<string | null>(null);

  constructor() {
    this.summaryState.load(() => this.leadsService.summary());
    this.listState.load(() => this.listSource());
  }

  // --- Carga --------------------------------------------------------------------

  /** Consulta efectiva: los filtros vacios no se envian (el servicio los descarta). */
  private query(): LeadQuery {
    return {
      status: this.status() || undefined,
      origin: this.origin() || undefined,
      priority: this.priority() || undefined,
      minScore: this.minScore() ?? undefined,
      search: this.search() || undefined,
      sort: this.sort(),
      page: this.page(),
      pageSize: this.pageSize,
    };
  }

  private listSource() {
    return this.leadsService.list(this.query()).pipe(
      map((response) => ({
        leads: response.data,
        page: response.meta.page ?? 1,
        pageSize: response.meta.pageSize ?? this.pageSize,
        total: response.meta.total ?? response.data.length,
        totalPages: response.meta.totalPages ?? 1,
        referenceDate: response.meta.demoReferenceDate ?? null,
      })),
    );
  }

  /** Recarga el listado conservando las filas en pantalla para que no parpadee. */
  protected loadList(keepData = true): void {
    this.listState.load(() => this.listSource(), { keepData });
  }

  /** Recarga solo el resumen del embudo. */
  protected loadSummary(): void {
    this.summaryState.load(() => this.leadsService.summary(), { keepData: true });
  }

  /** Reintento completo de la vista: se vuelven a pedir los tres bloques. */
  protected load(): void {
    this.loadSummary();
    this.loadList();
    const selected = this.selectedId();
    if (selected) this.loadDetail(selected);
  }

  private loadDetail(leadId: string): void {
    this.detailState.load(() => this.leadsService.get(leadId));
  }

  // --- Acciones de filtro -------------------------------------------------------

  protected onSearchInput(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
  }

  /** La busqueda se aplica al confirmar o al salir del campo, no en cada tecla. */
  protected applySearch(): void {
    const value = this.searchDraft().trim();
    if (value === this.search()) return;

    this.search.set(value);
    this.goToFirstPage();
  }

  protected onStatusChange(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as LeadStatus | '');
    this.goToFirstPage();
  }

  protected onOriginChange(event: Event): void {
    this.origin.set((event.target as HTMLSelectElement).value);
    this.goToFirstPage();
  }

  protected onPriorityChange(event: Event): void {
    this.priority.set((event.target as HTMLSelectElement).value as LeadPriority | '');
    this.goToFirstPage();
  }

  /** La puntuacion vive en la escala 0-100 que valida la API: se acota aqui. */
  protected onMinScoreChange(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const parsed = raw === '' ? null : Number(raw);
    this.minScore.set(parsed !== null && Number.isFinite(parsed) ? Math.min(100, Math.max(0, Math.round(parsed))) : null);
    this.goToFirstPage();
  }

  protected onSortChange(event: Event): void {
    this.sort.set((event.target as HTMLSelectElement).value as LeadSort);
    this.goToFirstPage();
  }

  /** Vuelve a la primera pagina y recarga: usado por todos los filtros. */
  private goToFirstPage(): void {
    this.page.set(1);
    this.loadList();
  }

  protected hasFilters(): boolean {
    return (
      this.search() !== '' ||
      this.status() !== '' ||
      this.origin() !== '' ||
      this.priority() !== '' ||
      this.minScore() !== null
    );
  }

  protected clearFilters(): void {
    this.searchDraft.set('');
    this.search.set('');
    this.status.set('');
    this.origin.set('');
    this.priority.set('');
    this.minScore.set(null);
    this.sort.set('score');
    this.goToFirstPage();
  }

  // --- Paginacion ---------------------------------------------------------------

  protected readonly currentPage = computed(() => this.listState.data()?.page ?? 1);
  protected readonly pageSizeValue = computed(() => this.listState.data()?.pageSize ?? this.pageSize);
  protected readonly totalPages = computed(() => this.listState.data()?.totalPages ?? 1);
  protected readonly total = computed(() => this.listState.data()?.total ?? 0);

  protected goToPage(target: number): void {
    const clamped = Math.min(Math.max(1, target), this.totalPages());
    if (clamped === this.currentPage()) return;

    this.page.set(clamped);
    this.loadList();
  }

  // --- Seleccion -----------------------------------------------------------------

  protected select(leadId: string): void {
    this.selectedId.set(leadId);
    this.loadDetail(leadId);
  }

  protected closeDetail(): void {
    this.selectedId.set(null);
    this.detailState.reset();
  }

  /** Reintento del detalle: la ficha seleccionada vuelve a pedirse a la API. */
  protected retryDetail(): void {
    const selected = this.selectedId();
    if (selected) this.loadDetail(selected);
  }

  // --- Datos derivados ------------------------------------------------------------

  protected readonly summary = computed(() => this.summaryState.data());
  protected readonly leads = computed(() => this.listState.data()?.leads ?? []);
  protected readonly detail = computed(() => this.detailState.data());
  protected readonly referenceDate = computed(() => this.listState.data()?.referenceDate ?? null);

  /** Carga inicial: hasta que no hay nada en pantalla no se dibuja la vista. */
  protected readonly initialLoading = computed(
    () => !this.summary() && !this.listState.data() && (this.summaryState.loading() || this.listState.loading()),
  );
  /** Error global: solo cuando no hay ningun dato previo que mantener en pantalla. */
  protected readonly viewError = computed(() =>
    this.summary() || this.listState.data() ? null : (this.summaryState.error() ?? this.listState.error()),
  );
  /** Errores por bloque: se muestran dentro de su panel sin vaciar el resto de la vista. */
  protected readonly summaryError = computed(() => (this.summary() ? null : this.summaryState.error()));
  protected readonly listError = computed(() => this.listState.error());

  protected readonly statusOptions = computed(() => this.summary()?.statuses ?? []);
  protected readonly originOptions = computed(() => this.summary()?.origins ?? []);
  protected readonly priorityOptions = computed(() => this.summary()?.byPriority ?? []);
  protected readonly topLeads = computed(() => this.summary()?.topLeads ?? []);
  protected readonly byOrigin = computed(() => this.summary()?.byOrigin ?? []);
  protected readonly sortOptions = SORT_OPTIONS;

  /** Embudo del estado comercial, con la tasa de paso respecto a la etapa anterior. */
  protected readonly funnel = computed<FunnelStep[]>(() => {
    const totals = this.summary()?.totals;
    if (!totals) return [];

    let previous: number | null = null;

    return FUNNEL_ORDER.map((status) => {
      const value = totals.byStatus[status] ?? 0;
      const stepRate = previous === null || previous === 0 ? 1 : value / previous;
      previous = value;

      return {
        key: status,
        label: LEAD_STATUS_LABEL[status],
        value,
        stepRate,
      };
    });
  });

  /** Serie corta para el sparkline del indicador de origen con mas leads. */
  protected readonly originRows = computed<BarRow[]>(() =>
    this.byOrigin()
      .map((row) => ({
        label: this.originLabel(row.origin),
        value: row.count,
        note: `${row.won} ganados`,
      }))
      .sort((a, b) => b.value - a.value),
  );

  // --- Utilidades de plantilla ----------------------------------------------------

  protected readonly statusLabel = (status: LeadStatus): string => LEAD_STATUS_LABEL[status];

  protected originLabel(origin: string): string {
    return labelOf(CHANNEL_LABEL, origin, origin);
  }

  protected priorityLabel(priority: string): string {
    return labelOf(PRIORITY_LABEL, priority, priority);
  }

  protected priorityTone(priority: string): string {
    return PRIORITY_TONE[priority as LeadPriority] ?? 'chip--neutral';
  }

  protected timelineLabel(type: string): string {
    return labelOf(TIMELINE_STEP_LABEL, type, type);
  }

  /** Estados de oferta y producto llegan en ingles: se traducen con el mapa comun. */
  protected offerStatusLabel(status: string): string {
    return labelOf(OFFER_STATUS_LABEL, status);
  }

  protected timelineSeverity(type: string): string {
    return TIMELINE_STEP_SEVERITY[type] ?? 'info';
  }

  /** Tono del marcador de la traza, reutilizando las clases globales del feed. */
  protected stepMarker(type: string): string {
    return `feed__marker--${this.timelineSeverity(type)}`;
  }
}
