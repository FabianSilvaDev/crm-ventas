/**
 * Campanas: inversion publicitaria, rendimiento y detalle de cada campana.
 *
 * Tres fuentes independientes: el resumen publicitario (`GET /campaigns/summary`),
 * el listado filtrable (`GET /campaigns`) y el detalle de la campana seleccionada
 * (`GET /campaigns/:id`).
 *
 * El unico grafico de barras codifica una sola medida -ingresos por canal- con un
 * unico tono; el ranking de campanas va como tabla, que es lo que permite comparar
 * varias metricas por fila sin mezclar escalas en un mismo eje.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import type { ApiMeta } from '../../core/models/api.model';
import type { Campaign } from '../../core/models/catalog.model';
import { CAMPAIGN_STATUS_LABEL, CHANNEL_LABEL, labelOf } from '../../core/models/labels';
import { CampaignsService, type CampaignQuery, type CampaignSummary } from '../../core/services/campaigns.service';
import { AsyncState } from '../../core/util/async-state';
import { AgentAvatarView } from '../../shared/components/agent-avatar/agent-avatar';
import { BarChart, type BarRow } from '../../shared/components/bar-chart/bar-chart';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { ProgressBar } from '../../shared/components/progress-bar/progress-bar';
import { StatTile } from '../../shared/components/stat-tile/stat-tile';
import { StateDisplay } from '../../shared/components/state-display/state-display';
import { StatusChip } from '../../shared/components/status-chip/status-chip';
import {
  CompactNumberPipe,
  DateEsPipe,
  EuroPipe,
  NumberEsPipe,
  PercentPipe,
  TimeAgoPipe,
} from '../../shared/pipes/format.pipes';

/** Ordenes admitidos por el listado de campanas. */
type CampaignSort = 'revenue' | 'roas' | 'spend' | 'conversions' | 'startDate' | 'name';

/** Opcion de un desplegable de filtro. */
interface FilterOption {
  value: string;
  label: string;
}

interface CampaignsView {
  items: Campaign[];
  total: number;
  channels: string[];
}

const CAMPAIGN_SORTS: { value: CampaignSort; label: string }[] = [
  { value: 'revenue', label: 'Mas ingreso' },
  { value: 'roas', label: 'Mejor ROAS' },
  { value: 'spend', label: 'Mayor gasto' },
  { value: 'conversions', label: 'Mas conversiones' },
  { value: 'startDate', label: 'Inicio mas reciente' },
  { value: 'name', label: 'Nombre (A-Z)' },
];

/**
 * Estados de campana: valores estables del contrato, asi que sus opciones salen
 * del mapa de etiquetas y no de las filas que devuelva el filtro vigente.
 */
const CAMPAIGN_STATUS_OPTIONS: FilterOption[] = Object.entries(CAMPAIGN_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));

/** Umbral del ritmo de gasto a partir del cual conviene avisar. */
const PACING_WARN = 0.9;

/** Valor de un control de formulario, ya estrechado a texto. */
const inputValue = (event: Event): string => (event.target as HTMLInputElement | HTMLSelectElement).value;

/** Lee una lista de opciones publicada por la API en `meta.filters`. */
const readFilter = (meta: ApiMeta, key: string): string[] => {
  const filters = meta['filters'] as Record<string, unknown> | undefined;
  const values = filters?.[key];
  return Array.isArray(values) ? values.filter((item): item is string => typeof item === 'string') : [];
};

@Component({
  selector: 'app-campaigns-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AgentAvatarView,
    BarChart,
    PixelIcon,
    ProgressBar,
    StatTile,
    StateDisplay,
    StatusChip,
    CompactNumberPipe,
    DateEsPipe,
    EuroPipe,
    NumberEsPipe,
    PercentPipe,
    TimeAgoPipe,
  ],
  templateUrl: './campaigns.html',
  styles: [
    `
      /* Gasto con su barra de ritmo: la cifra manda y la barra la matiza. */
      .pacing {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 96px;
      }

      .pacing__value {
        font-family: var(--px-font-mono);
        font-variant-numeric: tabular-nums;
        text-align: right;
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

      .table tbody tr.is-selected {
        background: var(--px-surface-3);
        box-shadow: inset 3px 0 0 0 var(--px-cyan);
      }

      .name-btn {
        padding: 0;
        background: none;
        border: 0;
        color: var(--px-cyan);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .name-btn:hover {
        text-decoration: underline;
      }

      /* La nota secundaria de una celda va en su propia linea. */
      .cell-note {
        display: block;
      }
    `,
  ],
})
export class CampaignsPage {
  private readonly campaignsService = inject(CampaignsService);

  protected readonly summaryState = new AsyncState<CampaignSummary>();
  protected readonly listState = new AsyncState<CampaignsView>();
  protected readonly detailState = new AsyncState<Campaign>();

  /** Filtros vigentes del listado. */
  protected readonly status = signal('');
  protected readonly channel = signal('');
  protected readonly search = signal('');
  protected readonly sort = signal<CampaignSort>('revenue');

  /** Campana cuyo detalle se muestra. */
  protected readonly selectedId = signal<string | null>(null);

  /** Fecha de referencia de la demo, publicada por la API en `meta`. */
  protected readonly referenceDate = signal<string | null>(null);

  protected readonly statusOptions = CAMPAIGN_STATUS_OPTIONS;
  protected readonly sorts = CAMPAIGN_SORTS;
  /** Umbral de aviso del ritmo de gasto, escrito tambien en pantalla. */
  protected readonly pacingWarn = PACING_WARN;

  constructor() {
    this.loadSummary();
    this.loadList(false);
  }

  // --- Carga de datos -------------------------------------------------------

  protected loadSummary(): void {
    this.summaryState.load(() => this.campaignsService.summary());
  }

  /** Recarga el listado con los filtros vigentes; `keepData` evita el parpadeo. */
  protected loadList(keepData = true): void {
    const query: CampaignQuery = {
      status: this.status(),
      channel: this.channel(),
      search: this.search(),
      sort: this.sort(),
    };

    this.listState.load(
      () =>
        this.campaignsService.list(query).pipe(
          map((response) => {
            this.referenceDate.set(response.meta.demoReferenceDate ?? null);
            this.syncSelection(response.data);
            return {
              items: response.data,
              total: response.meta.total ?? response.data.length,
              channels: readFilter(response.meta, 'channels'),
            };
          }),
        ),
      { keepData },
    );
  }

  /** Carga el detalle de la campana indicada. */
  private loadDetail(id: string): void {
    this.detailState.load(() => this.campaignsService.get(id));
  }

  /** Si la campana seleccionada desaparece con el filtro aplicado, pasa a la primera. */
  private syncSelection(items: Campaign[]): void {
    const current = this.selectedId();
    if (items.some((campaign) => campaign.id === current)) return;
    this.selectCampaign(items[0]?.id ?? null);
  }

  protected selectCampaign(id: string | null): void {
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

  protected onChannel(event: Event): void {
    this.channel.set(inputValue(event));
    this.loadList();
  }

  protected onSearch(event: Event): void {
    this.search.set(inputValue(event));
    this.loadList();
  }

  protected onSort(event: Event): void {
    this.sort.set(inputValue(event) as CampaignSort);
    this.loadList();
  }

  // --- Datos ya resueltos ---------------------------------------------------

  protected readonly totals = computed(() => this.summaryState.data()?.totals ?? null);
  protected readonly ranking = computed(() => this.summaryState.data()?.ranking ?? []);
  protected readonly campaigns = computed(() => this.listState.data()?.items ?? []);
  protected readonly campaignTotal = computed(() => this.listState.data()?.total ?? 0);
  protected readonly detail = computed(() => this.detailState.data());

  /** Ritmo de gasto global (gasto entre presupuesto), tal como lo calcula la API. */
  protected readonly pacing = computed(() => this.totals()?.budgetPacing ?? 0);

  /**
   * Canales ofrecidos por la API en `meta.filters.channels`; si el listado no los
   * publica, se cae al catalogo de canales del contrato para no dejar el filtro mudo.
   */
  protected readonly channelOptions = computed<FilterOption[]>(() => {
    const channels = this.listState.data()?.channels;
    const values = channels && channels.length > 0 ? channels : Object.keys(CHANNEL_LABEL);
    return values.map((value) => ({ value, label: labelOf(CHANNEL_LABEL, value) }));
  });

  /** Ingresos por canal: una sola medida y un unico tono. */
  protected readonly byChannelRows = computed<BarRow[]>(() =>
    (this.summaryState.data()?.byChannel ?? []).map((row) => ({
      label: labelOf(CHANNEL_LABEL, row.label),
      value: row.revenue,
    })),
  );

  protected readonly hasActiveFilters = computed(
    () => this.status() !== '' || this.channel() !== '' || this.search() !== '',
  );

  // --- Utilidades de plantilla ----------------------------------------------

  /** Color del ritmo de gasto: verde por debajo del umbral, ambar cerca y rojo pasado. */
  protected pacingColor(value: number): string {
    if (value > 1) return '#d03b3b';
    if (value >= PACING_WARN) return '#ffc44d';
    return '#5ce08a';
  }

  /** Aviso textual del ritmo, para que el color no sea el unico canal. */
  protected pacingLabel(value: number): string {
    if (value > 1) return 'Presupuesto superado';
    if (value >= PACING_WARN) return 'Cerca del limite';
    return 'Dentro del presupuesto';
  }

  protected channelLabel(channel: string | null): string {
    return labelOf(CHANNEL_LABEL, channel);
  }

  protected channelList(channels: string[]): string {
    return channels.map((channel) => labelOf(CHANNEL_LABEL, channel)).join(' · ');
  }

  /** Etiqueta del objetivo de la campana, capitalizada para encabezados. */
  protected objectiveLabel(objective: string): string {
    return objective.charAt(0).toUpperCase() + objective.slice(1);
  }
}
