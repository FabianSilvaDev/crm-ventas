/**
 * Contenido y creatividades (Marketing Studio y Creative Studio).
 *
 * La vista reune dos listados independientes -piezas editoriales y creatividades
 * publicitarias- mas un resumen agregado. Cada uno tiene su propia carga y su
 * propio estado de error, de modo que un fallo parcial no deja la pantalla en
 * blanco.
 *
 * Nada se calcula aqui: las cifras salen de `/content/summary`, `/content` y
 * `/creatives`. La vista solo traduce etiquetas, elige la medida que representa
 * cada grafico y marca los umbrales de presentacion.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map, tap } from 'rxjs';
import type { ApiMeta } from '../../core/models/api.model';
import type { ContentPiece, Creative } from '../../core/models/catalog.model';
import {
  CHANNEL_LABEL,
  CONTENT_STATUS_LABEL,
  CONTENT_TYPE_LABEL,
  CREATIVE_STATUS_LABEL,
  labelOf,
} from '../../core/models/labels';
import {
  ContentService,
  type ContentQuery,
  type ContentSummary,
  type CreativeQuery,
} from '../../core/services/content.service';
import { AsyncState } from '../../core/util/async-state';
import { AgentAvatarView } from '../../shared/components/agent-avatar/agent-avatar';
import { BarChart, type BarRow } from '../../shared/components/bar-chart/bar-chart';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { StatTile } from '../../shared/components/stat-tile/stat-tile';
import { StateDisplay } from '../../shared/components/state-display/state-display';
import { StatusChip } from '../../shared/components/status-chip/status-chip';
import { CompactNumberPipe, DateEsPipe, NumberEsPipe, PercentPipe, TimeAgoPipe } from '../../shared/pipes/format.pipes';

/** Opcion de un desplegable de filtro: valor estable de la API y etiqueta en espanol. */
interface FilterOption {
  value: string;
  label: string;
}

/** Ordenes admitidos por el listado de piezas. */
type PieceSort = 'recent' | 'impressions' | 'conversions' | 'title';
/** Ordenes admitidos por el listado de creatividades. */
type CreativeSort = 'impressions' | 'conversions' | 'recent' | 'name';

interface PiecesView {
  items: ContentPiece[];
  total: number;
}

interface CreativesView {
  items: Creative[];
  total: number;
  formats: string[];
}

/**
 * Tipo y estado son enums estables del contrato, no filas de la simulacion: sus
 * opciones se derivan de los mapas de etiquetas, que son la unica fuente de
 * traduccion del proyecto, y no de lo que devuelva el filtro vigente.
 */
const TYPE_OPTIONS: FilterOption[] = Object.entries(CONTENT_TYPE_LABEL).map(([value, label]) => ({ value, label }));
const PIECE_STATUS_OPTIONS: FilterOption[] = Object.entries(CONTENT_STATUS_LABEL).map(([value, label]) => ({ value, label }));
const CREATIVE_STATUS_OPTIONS: FilterOption[] = Object.entries(CREATIVE_STATUS_LABEL).map(([value, label]) => ({ value, label }));

const PIECE_SORTS: { value: PieceSort; label: string }[] = [
  { value: 'recent', label: 'Mas recientes' },
  { value: 'impressions', label: 'Mas impresiones' },
  { value: 'conversions', label: 'Mas conversiones' },
  { value: 'title', label: 'Titulo (A-Z)' },
];

const CREATIVE_SORTS: { value: CreativeSort; label: string }[] = [
  { value: 'impressions', label: 'Mas impresiones' },
  { value: 'conversions', label: 'Mas conversiones' },
  { value: 'recent', label: 'Mas recientes' },
  { value: 'name', label: 'Nombre (A-Z)' },
];

/** Valor de un control de formulario, ya estrechado a texto. */
const inputValue = (event: Event): string => (event.target as HTMLInputElement | HTMLSelectElement).value;

/** Lee una lista de opciones publicada por la API en `meta.filters`. */
const readFilter = (meta: ApiMeta, key: string): string[] => {
  const filters = meta['filters'] as Record<string, unknown> | undefined;
  const values = filters?.[key];
  return Array.isArray(values) ? values.filter((item): item is string => typeof item === 'string') : [];
};

@Component({
  selector: 'app-content-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    AgentAvatarView,
    BarChart,
    PixelIcon,
    StatTile,
    StateDisplay,
    StatusChip,
    CompactNumberPipe,
    DateEsPipe,
    NumberEsPipe,
    PercentPipe,
    TimeAgoPipe,
  ],
  templateUrl: './content.html',
  styles: [
    `
      /* El encabezado de fila lleva titulos, no etiquetas: se lee como texto normal. */
      .table th[scope='row'] {
        font-family: var(--px-font-ui);
        font-size: 12.5px;
        font-weight: 500;
        letter-spacing: 0;
        text-transform: none;
        color: var(--px-ink);
        white-space: normal;
      }

      /* La nota secundaria de una celda va en su propia linea. */
      .cell-note {
        display: block;
      }
    `,
  ],
})
export class ContentPage {
  private readonly contentService = inject(ContentService);

  protected readonly summaryState = new AsyncState<ContentSummary>();
  protected readonly piecesState = new AsyncState<PiecesView>();
  protected readonly creativesState = new AsyncState<CreativesView>();

  /** Filtros vigentes del listado de piezas. */
  protected readonly pieceType = signal('');
  protected readonly pieceStatus = signal('');
  protected readonly pieceSearch = signal('');
  protected readonly pieceSort = signal<PieceSort>('recent');

  /** Filtros vigentes del listado de creatividades. */
  protected readonly creativeFormat = signal('');
  protected readonly creativeStatus = signal('');
  protected readonly creativeSearch = signal('');
  protected readonly creativeSort = signal<CreativeSort>('impressions');

  /** Fecha de referencia de la demo: la publica la API en `meta` y ordena los "hace X". */
  protected readonly referenceDate = signal<string | null>(null);

  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly pieceStatusOptions = PIECE_STATUS_OPTIONS;
  protected readonly creativeStatusOptions = CREATIVE_STATUS_OPTIONS;
  protected readonly pieceSorts = PIECE_SORTS;
  protected readonly creativeSorts = CREATIVE_SORTS;

  constructor() {
    this.loadSummary();
    this.loadPieces(false);
    this.loadCreatives(false);
  }

  // --- Carga de datos -------------------------------------------------------

  protected loadSummary(): void {
    this.summaryState.load(() => this.contentService.summary());
  }

  /** Recarga las piezas con los filtros vigentes; `keepData` evita el parpadeo. */
  protected loadPieces(keepData = true): void {
    const query: ContentQuery = {
      type: this.pieceType(),
      status: this.pieceStatus(),
      search: this.pieceSearch(),
      sort: this.pieceSort(),
    };

    this.piecesState.load(
      () =>
        this.contentService.list(query).pipe(
          tap((response) => this.referenceDate.set(response.meta.demoReferenceDate ?? null)),
          map((response) => ({
            items: response.data,
            total: response.meta.total ?? response.data.length,
          })),
        ),
      { keepData },
    );
  }

  /** Recarga las creatividades con los filtros vigentes. */
  protected loadCreatives(keepData = true): void {
    const query: CreativeQuery = {
      format: this.creativeFormat(),
      status: this.creativeStatus(),
      search: this.creativeSearch(),
      sort: this.creativeSort(),
    };

    this.creativesState.load(
      () =>
        this.contentService.creatives(query).pipe(
          tap((response) => this.referenceDate.set(response.meta.demoReferenceDate ?? null)),
          map((response) => ({
            items: response.data,
            total: response.meta.total ?? response.data.length,
            formats: readFilter(response.meta, 'formats'),
          })),
        ),
      { keepData },
    );
  }

  /** Recarga las tres fuentes de la vista. */
  protected refreshAll(): void {
    this.loadSummary();
    this.loadPieces();
    this.loadCreatives();
  }

  // --- Filtros --------------------------------------------------------------

  protected onPieceType(event: Event): void {
    this.pieceType.set(inputValue(event));
    this.loadPieces();
  }

  protected onPieceStatus(event: Event): void {
    this.pieceStatus.set(inputValue(event));
    this.loadPieces();
  }

  protected onPieceSearch(event: Event): void {
    this.pieceSearch.set(inputValue(event));
    this.loadPieces();
  }

  protected onPieceSort(event: Event): void {
    this.pieceSort.set(inputValue(event) as PieceSort);
    this.loadPieces();
  }

  protected onCreativeFormat(event: Event): void {
    this.creativeFormat.set(inputValue(event));
    this.loadCreatives();
  }

  protected onCreativeStatus(event: Event): void {
    this.creativeStatus.set(inputValue(event));
    this.loadCreatives();
  }

  protected onCreativeSearch(event: Event): void {
    this.creativeSearch.set(inputValue(event));
    this.loadCreatives();
  }

  protected onCreativeSort(event: Event): void {
    this.creativeSort.set(inputValue(event) as CreativeSort);
    this.loadCreatives();
  }

  // --- Datos ya resueltos ---------------------------------------------------

  protected readonly totals = computed(() => this.summaryState.data()?.totals ?? null);
  protected readonly pieces = computed(() => this.piecesState.data()?.items ?? []);
  protected readonly creatives = computed(() => this.creativesState.data()?.items ?? []);
  protected readonly pieceTotal = computed(() => this.piecesState.data()?.total ?? 0);
  protected readonly creativeTotal = computed(() => this.creativesState.data()?.total ?? 0);

  /** Formatos de creatividad que publica la API en `meta.filters.formats`. */
  protected readonly creativeFormats = computed<FilterOption[]>(() =>
    (this.creativesState.data()?.formats ?? []).map((format) => ({ value: format, label: format })),
  );

  /**
   * Recuento de piezas por tipo: una unica medida por categoria (la longitud de la
   * barra). Las conversiones acompanan como nota textual, nunca como una segunda
   * magnitud codificada.
   */
  protected readonly byTypeRows = computed<BarRow[]>(() =>
    (this.summaryState.data()?.byType ?? []).map((row) => ({
      label: labelOf(CONTENT_TYPE_LABEL, row.type),
      value: row.count,
      note: `${row.conversions} conv.`,
    })),
  );

  // --- Utilidades de plantilla ----------------------------------------------

  protected typeLabel(type: string): string {
    return labelOf(CONTENT_TYPE_LABEL, type);
  }

  protected channelLabel(channel: string): string {
    return labelOf(CHANNEL_LABEL, channel);
  }

  /** Primeras palabras clave de la pieza, como pista de su tema. */
  protected keywordsOf(piece: ContentPiece): string {
    return piece.keywords.slice(0, 3).join(' · ');
  }

  protected readonly hasActivePieceFilters = computed(
    () => this.pieceType() !== '' || this.pieceStatus() !== '' || this.pieceSearch() !== '',
  );

  protected readonly hasActiveCreativeFilters = computed(
    () => this.creativeFormat() !== '' || this.creativeStatus() !== '' || this.creativeSearch() !== '',
  );
}
