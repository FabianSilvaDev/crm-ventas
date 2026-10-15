/**
 * Analitica: indicadores agregados, embudo, series temporales y atribucion.
 *
 * Todo sale de `GET /analytics?range=`, que acepta la ventana en dias. La vista no
 * recalcula ninguna cifra: solo traduce etiquetas y decide que grafico corresponde
 * a cada medida. Las dos medidas de escala distinta (dinero y leads) van en dos
 * graficos separados, nunca en un unico eje.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { Analytics } from '../../core/models/insights.model';
import { CHANNEL_LABEL, labelOf } from '../../core/models/labels';
import { AnalyticsService } from '../../core/services/analytics.service';
import { AsyncState } from '../../core/util/async-state';
import { formatPercent } from '../../shared/format/format';
import { BarChart, type BarRow } from '../../shared/components/bar-chart/bar-chart';
import { FunnelChart } from '../../shared/components/funnel-chart/funnel-chart';
import { LineChart, type ChartPoint, type ChartSeries } from '../../shared/components/line-chart/line-chart';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { StatTile } from '../../shared/components/stat-tile/stat-tile';
import { StateDisplay } from '../../shared/components/state-display/state-display';
import { StatusChip } from '../../shared/components/status-chip/status-chip';
import { EuroPipe, NumberEsPipe, PercentPipe } from '../../shared/pipes/format.pipes';

/** Ventanas temporales que acepta la API (7 a 30 dias; 14 por defecto). */
const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

@Component({
  selector: 'app-analytics-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BarChart,
    FunnelChart,
    LineChart,
    PixelIcon,
    StatTile,
    StateDisplay,
    StatusChip,
    EuroPipe,
    NumberEsPipe,
    PercentPipe,
  ],
  templateUrl: './analytics.html',
  styles: [
    `
      .insight {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 10px;
        align-items: start;
        padding: 10px 12px;
        background: var(--px-surface-1);
        border: 2px solid var(--px-line);
      }

      .insight__title {
        font-size: 12.5px;
        font-weight: 600;
      }

      .insight__detail {
        font-size: 11.5px;
        color: var(--px-ink-muted);
      }
    `,
  ],
})
export class AnalyticsPage {
  private readonly analyticsService = inject(AnalyticsService);

  protected readonly state = new AsyncState<Analytics>();

  /** Ventana temporal activa, en dias. Cambiarla vuelve a pedir la analitica. */
  protected readonly range = signal<Range>(14);
  protected readonly ranges = RANGES;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.load(() => this.analyticsService.get(this.range()));
  }

  /** Cambio de ventana: se conservan los datos para que la vista no parpadee. */
  protected setRange(value: Range): void {
    if (value === this.range()) return;

    this.range.set(value);
    this.state.load(() => this.analyticsService.get(value), { keepData: true });
  }

  protected refresh(): void {
    this.state.load(() => this.analyticsService.get(this.range()), { keepData: true });
  }

  // --- Bloques de la respuesta ---------------------------------------------------

  protected readonly data = computed(() => this.state.data());
  protected readonly overview = computed(() => this.state.data()?.overview ?? null);
  protected readonly funnel = computed(() => this.state.data()?.funnel ?? []);
  protected readonly channels = computed(() => this.state.data()?.channels ?? []);
  protected readonly products = computed(() => this.state.data()?.products ?? []);
  protected readonly campaigns = computed(() => this.state.data()?.campaigns ?? []);
  protected readonly experiments = computed(() => this.state.data()?.experiments ?? []);
  protected readonly insights = computed(() => this.state.data()?.insights ?? []);

  // --- Series ---------------------------------------------------------------------

  /** Dinero: ingreso y gasto comparten unidad (EUR), asi que comparten un unico eje. */
  protected readonly revenuePoints = computed<ChartPoint[]>(
    () =>
      this.data()?.timeseries.revenue.map((point) => ({
        label: point.label,
        values: { revenue: point.revenue, spend: point.spend },
      })) ?? [],
  );

  protected readonly revenueSeriesDef = computed<ChartSeries[]>(() => [
    { key: 'revenue', label: 'Ingreso simulado', color: 'var(--series-1)' },
    { key: 'spend', label: 'Gasto', color: 'var(--series-2)' },
  ]);

  /** Leads: una sola medida, un solo eje y una unica serie. */
  protected readonly leadPoints = computed<ChartPoint[]>(
    () => this.data()?.timeseries.leads.map((point) => ({ label: point.label, values: { leads: point.value } })) ?? [],
  );

  protected readonly leadSeriesDef = computed<ChartSeries[]>(() => [
    { key: 'leads', label: 'Leads captados', color: 'var(--series-3)' },
  ]);

  protected readonly revenueTrend = computed(() => this.data()?.timeseries.revenue.map((point) => point.revenue) ?? []);
  protected readonly leadsTrend = computed(() => this.data()?.timeseries.leads.map((point) => point.value) ?? []);

  /** Una sola medida (ingreso) por canal: un unico tono y el nombre como identidad. */
  protected readonly channelRows = computed<BarRow[]>(() =>
    this.channels().map((row) => ({
      label: this.channelLabel(row.label),
      value: row.revenue,
      note: `${row.roas}x`,
    })),
  );

  // --- Utilidades de plantilla ----------------------------------------------------

  /** Los canales llegan con su clave interna; la etiqueta en espanol vive en `labels`. */
  protected channelLabel(channel: string): string {
    return labelOf(CHANNEL_LABEL, channel, channel);
  }

  /** Variante ganadora o alternativa, con su tasa de conversion como texto. */
  protected variantLabel(name: string, conversionRate: number): string {
    return `${name} · ${formatPercent(conversionRate, 1)}`;
  }
}
