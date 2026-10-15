/**
 * Productos y ofertas: el catalogo investigado y las ofertas que se derivan de el.
 *
 * El listado (`GET /products`) trae la ficha comercial de cada producto; el detalle
 * (`GET /products/:id`) anade la investigacion que lo respalda, las campanas, las
 * landings, el embudo de leads y la linea temporal. Las ofertas viven en su propia
 * pestana y se piden a `GET /offers`.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map, tap } from 'rxjs';
import type { FunnelStep } from '../../core/models/insights.model';
import type { Offer, OfferStatus, Product, ProductStatus } from '../../core/models/catalog.model';
import { CHANNEL_LABEL, PRODUCT_STATUS_LABEL, RESEARCH_TYPE_LABEL, labelOf } from '../../core/models/labels';
import { ProductsService, type ProductQuery } from '../../core/services/products.service';
import { AsyncState } from '../../core/util/async-state';
import { BarChart, type BarRow } from '../../shared/components/bar-chart/bar-chart';
import { FunnelChart } from '../../shared/components/funnel-chart/funnel-chart';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { ProgressBar } from '../../shared/components/progress-bar/progress-bar';
import { StateDisplay } from '../../shared/components/state-display/state-display';
import { StatusChip } from '../../shared/components/status-chip/status-chip';
import { DateEsPipe, EuroPipe, NumberEsPipe, PercentPipe, TimeAgoPipe } from '../../shared/pipes/format.pipes';

type ProductSort = NonNullable<ProductQuery['sort']>;

/** Orden admitido por `GET /products?sort=`, con su etiqueta en espanol. */
const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'revenue', label: 'Ingresos' },
  { value: 'score', label: 'Score de validacion' },
  { value: 'margin', label: 'Margen' },
  { value: 'name', label: 'Nombre' },
  { value: 'updated', label: 'Ultima actualizacion' },
];

/** Estados que admite `GET /offers?status=`, con su etiqueta en espanol. */
const OFFER_STATUS_OPTIONS: { value: OfferStatus; label: string }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'ready', label: 'Lista' },
  { value: 'active', label: 'Activa' },
  { value: 'paused', label: 'Pausada' },
];

/** Todo lo que necesita el catalogo, resuelto en una sola carga. */
interface ProductsView {
  products: Product[];
  total: number;
  referenceDate: string | null;
  /** Categorias que ofrece la API en `meta.filters.categories`. */
  categories: string[];
  /** Estados que acepta el filtro, tal como los publica la API en `meta.filters`. */
  statuses: ProductStatus[];
}

/** Ofertas y su fecha de referencia. */
interface OffersView {
  offers: Offer[];
  total: number;
  referenceDate: string | null;
}

@Component({
  selector: 'app-products-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    BarChart,
    FunnelChart,
    PixelIcon,
    ProgressBar,
    StateDisplay,
    StatusChip,
    DateEsPipe,
    EuroPipe,
    NumberEsPipe,
    PercentPipe,
    TimeAgoPipe,
  ],
  templateUrl: './products.html',
  styles: [
    `
      /* Tarjeta de producto: toda la tarjeta abre el detalle. */
      .product-card {
        display: flex;
        flex-direction: column;
        gap: 9px;
        padding: 12px;
        background: var(--px-surface-2);
        border: 2px solid var(--px-line);
        box-shadow: var(--px-inset-light), var(--px-shadow-sm);
        text-align: left;
        color: inherit;
        cursor: pointer;
      }

      .product-card:hover {
        border-color: var(--px-line-strong);
      }

      /* Marca visual del producto abierto; el detalle se muestra debajo. */
      .product-card--selected {
        border-color: var(--px-cyan);
        box-shadow: 0 0 0 2px var(--px-cyan), var(--px-inset-light), var(--px-shadow-sm);
      }

      .product-card__name {
        font-family: var(--px-font-mono);
        font-size: 12.5px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .product-card__meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 10.5px;
        color: var(--px-ink-muted);
      }

      /* Nivel de una oferta: cada tramo con su precio y lo que incluye. */
      .tier {
        padding: 8px 10px;
        background: var(--px-surface-1);
        border: 2px solid var(--px-line);
      }
    `,
  ],
})
export class ProductsPage {
  private readonly products = inject(ProductsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = new AsyncState<ProductsView>();
  /** Detalle del producto abierto: investigacion, campanas, landings y embudo. */
  protected readonly detail = new AsyncState<Product>();
  /** Ofertas derivadas, en su propia pestana. */
  protected readonly offers = new AsyncState<OffersView>();

  /** Pestana visible: catalogo de productos u ofertas. */
  protected readonly tab = signal<'catalogo' | 'ofertas'>('catalogo');

  // --- Filtros ----------------------------------------------------------------

  protected readonly search = signal('');
  protected readonly status = signal<ProductStatus | ''>('');
  protected readonly category = signal('');
  protected readonly sort = signal<ProductSort>('revenue');
  protected readonly offerStatus = signal<OfferStatus | ''>('');

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly offerStatusOptions = OFFER_STATUS_OPTIONS;

  protected readonly selectedId = signal<string | null>(null);

  /** Temporizador del buscador: evita una peticion por cada tecla. */
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
    this.destroyRef.onDestroy(() => this.clearSearchTimer());
  }

  // --- Carga ------------------------------------------------------------------

  /** Peticion del catalogo: productos filtrados. */
  private source() {
    return this.products
      .list({
        status: this.status() || undefined,
        category: this.category() || undefined,
        search: this.search().trim() || undefined,
        sort: this.sort(),
      })
      .pipe(
        map((response) => {
          const filters = (response.meta['filters'] ?? {}) as {
            categories?: string[];
            statuses?: ProductStatus[];
          };

          return {
            products: response.data,
            total: response.meta.total ?? response.data.length,
            referenceDate: response.meta.demoReferenceDate ?? null,
            categories: filters.categories ?? [],
            statuses: filters.statuses ?? [],
          };
        }),
        // El detalle nunca queda vacio: abre el primer producto del listado.
        tap((view) => this.syncSelection(view.products)),
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

  /** Abre un producto y pide su detalle ampliado. */
  protected selectProduct(productId: string): void {
    this.selectedId.set(productId);
    this.detail.load(() => this.products.get(productId));
  }

  /** Mantiene abierto un producto que siga estando en el listado; si no, usa el primero. */
  private syncSelection(products: Product[]): void {
    const current = this.selectedId();
    if (current && products.some((product) => product.id === current)) return;

    const first = products[0];
    if (first) {
      this.selectProduct(first.id);
      return;
    }

    this.selectedId.set(null);
    this.detail.reset();
  }

  protected reloadDetail(): void {
    const productId = this.selectedId();
    if (productId) this.selectProduct(productId);
  }

  // --- Pestanas y filtros -----------------------------------------------------

  protected setTab(tab: 'catalogo' | 'ofertas'): void {
    this.tab.set(tab);
    // Las ofertas solo se piden cuando hacen falta.
    if (tab === 'ofertas' && this.offers.data() === null && !this.offers.loading()) this.loadOffers();
  }

  /** Ofertas derivadas de los productos, con el filtro de estado aplicado. */
  protected loadOffers(): void {
    this.offers.load(() =>
      this.products.offers({ status: this.offerStatus() || undefined }).pipe(
        map((response) => ({
          offers: response.data,
          total: response.meta.total ?? response.data.length,
          referenceDate: response.meta.demoReferenceDate ?? null,
        })),
      ),
    );
  }

  protected onOfferStatusChange(value: string): void {
    this.offerStatus.set(value === '' ? '' : (value as OfferStatus));
    this.loadOffers();
  }

  protected onSearchInput(value: string): void {
    this.search.set(value);
    this.clearSearchTimer();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.reload();
    }, 300);
  }

  protected onStatusChange(value: string): void {
    this.status.set(value === '' ? '' : (value as ProductStatus));
    this.reload();
  }

  protected onCategoryChange(value: string): void {
    this.category.set(value);
    this.reload();
  }

  protected onSortChange(value: string): void {
    this.sort.set(value as ProductSort);
    this.reload();
  }

  protected clearFilters(): void {
    this.clearSearchTimer();
    this.search.set('');
    this.status.set('');
    this.category.set('');
    this.sort.set('revenue');
    this.reload();
  }

  protected readonly hasFilters = computed(
    () =>
      this.search().trim() !== '' || this.status() !== '' || this.category() !== '' || this.sort() !== 'revenue',
  );

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  // --- Datos derivados --------------------------------------------------------

  protected readonly catalog = computed(() => this.state.data()?.products ?? []);
  protected readonly total = computed(() => this.state.data()?.total ?? 0);
  protected readonly categories = computed(() => this.state.data()?.categories ?? []);
  protected readonly statuses = computed(() => this.state.data()?.statuses ?? []);
  protected readonly referenceDate = computed(() => this.state.data()?.referenceDate ?? null);
  protected readonly offersList = computed(() => this.offers.data()?.offers ?? []);

  /**
   * Embudo de leads del producto.
   * La API solo publica captados y ganados, asi que el embudo tiene esas dos etapas:
   * inventar los estados intermedios seria dibujar datos que no existen.
   */
  protected readonly leadFunnel = computed<FunnelStep[]>(() => {
    const leads = this.detail.data()?.leads;
    if (!leads) return [];

    return [
      { key: 'captados', label: 'Leads captados', value: leads.total, stepRate: 1 },
      {
        key: 'ganados',
        label: 'Leads ganados',
        value: leads.won,
        stepRate: leads.total === 0 ? 0 : leads.won / leads.total,
      },
    ];
  });

  /** Ingreso por campana asociada, como barras comparables. */
  protected readonly campaignRows = computed<BarRow[]>(() =>
    (this.detail.data()?.campaigns ?? []).map((campaign) => ({
      label: campaign.name,
      value: campaign.revenue,
      note: `${campaign.roas}x`,
    })),
  );

  protected productStatusLabel(status: string): string {
    return labelOf(PRODUCT_STATUS_LABEL, status);
  }

  protected channelLabel(channel: string): string {
    return labelOf(CHANNEL_LABEL, channel);
  }

  protected typeLabel(type: string): string {
    return labelOf(RESEARCH_TYPE_LABEL, type);
  }

  /** Tono del score de validacion: acompaña siempre a la cifra, nunca la sustituye. */
  protected scoreColor(score: number): string {
    if (score >= 80) return '#5ce08a';
    if (score >= 60) return '#ffc44d';
    return '#d03b3b';
  }
}
