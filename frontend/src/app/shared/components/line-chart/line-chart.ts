/**
 * Grafico de lineas para series temporales.
 *
 * Reglas del sistema de visualizacion que aplica este componente:
 *  - Un unico eje Y: nunca dos escalas en el mismo grafico. Dos medidas de escala
 *    distinta van en dos graficos o comparten eje si son comparables.
 *  - Leyenda siempre presente cuando hay 2 o mas series, ademas de etiqueta
 *    directa en el punto activo: la identidad nunca depende solo del color.
 *  - Rejilla y ejes discretos; lineas de 2 px; marcadores de 8 px al pasar el raton.
 *  - Capa de interaccion por defecto (cursor vertical + tooltip) y tabla de datos
 *    alternativa para quien no puede usar el color o el raton.
 */
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatCompact, formatEuro, formatNumber, formatPercent, niceCeiling } from '../../format/format';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ChartPoint {
  label: string;
  values: Record<string, number>;
}

export type ValueFormat = 'currency' | 'number' | 'percent' | 'compact';

const VIEW_WIDTH = 720;
const PAD_LEFT = 58;
const PAD_RIGHT = 16;
const PAD_TOP = 14;
const PAD_BOTTOM = 28;

@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" (mouseleave)="clearActive()">
      @if (series().length > 1) {
        <div class="legend">
          @for (item of series(); track item.key) {
            <span class="legend__item">
              <span class="legend__swatch" [style.background]="item.color"></span>
              {{ item.label }}
            </span>
          }
        </div>
      }

      <svg
        class="chart__svg"
        [attr.viewBox]="'0 0 ' + viewWidth + ' ' + height()"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        <!-- Rejilla y escala Y -->
        @for (line of geometry().gridLines; track line.y) {
          <line
            class="chart__grid-line"
            [attr.x1]="padLeft"
            [attr.x2]="viewWidth - padRight"
            [attr.y1]="line.y"
            [attr.y2]="line.y"
          />
          <text class="chart__tick" [attr.x]="padLeft - 7" [attr.y]="line.y + 3" text-anchor="end">
            {{ line.label }}
          </text>
        }

        <line
          class="chart__axis-line"
          [attr.x1]="padLeft"
          [attr.x2]="viewWidth - padRight"
          [attr.y1]="geometry().baselineY"
          [attr.y2]="geometry().baselineY"
        />

        <!-- Series -->
        @for (item of geometry().paths; track item.key) {
          <path class="chart__line" [attr.d]="item.path" [attr.stroke]="item.color" />
        }

        <!-- Etiquetas del eje X -->
        @for (tick of geometry().xTicks; track tick.x) {
          <text class="chart__tick" [attr.x]="tick.x" [attr.y]="height() - 9" text-anchor="middle">
            {{ tick.label }}
          </text>
        }

        <!-- Capa de interaccion -->
        <rect
          [attr.x]="padLeft"
          [attr.y]="padTop"
          [attr.width]="geometry().plotWidth"
          [attr.height]="geometry().plotHeight"
          fill="transparent"
          (mousemove)="onPointerMove($event)"
          (mouseleave)="clearActive()"
        />

        @if (active(); as current) {
          <line
            class="chart__axis-line"
            [attr.x1]="current.x"
            [attr.x2]="current.x"
            [attr.y1]="padTop"
            [attr.y2]="geometry().baselineY"
          />
          @for (point of current.points; track point.key) {
            <circle class="chart__dot" [attr.cx]="current.x" [attr.cy]="point.y" r="4" [attr.fill]="point.color" />
          }
        }
      </svg>

      @if (active(); as current) {
        <div
          class="chart-tooltip"
          [style.left.%]="current.leftPercent"
          [style.top.px]="2"
          [style.transform]="current.transform"
        >
          <p class="chart-tooltip__title">{{ current.label }}</p>
          @for (row of current.rows; track row.key) {
            <p class="chart-tooltip__row">
              <span class="chart-tooltip__key">
                <span class="legend__swatch" [style.background]="row.color"></span>
                {{ row.label }}
              </span>
              <span class="chart-tooltip__value">{{ row.value }}</span>
            </p>
          }
        </div>
      }

      <button type="button" class="chart__table-toggle" (click)="toggleTable()">
        {{ showTable() ? 'Ocultar tabla de datos' : 'Ver tabla de datos' }}
      </button>

      @if (showTable()) {
        <div class="table-wrap">
          <table class="table table--compact">
            <thead>
              <tr>
                <th scope="col">Periodo</th>
                @for (item of series(); track item.key) {
                  <th scope="col" class="num">{{ item.label }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (point of points(); track point.label) {
                <tr>
                  <th scope="row" class="text-dim">{{ point.label }}</th>
                  @for (item of series(); track item.key) {
                    <td class="num">{{ format(point.values[item.key] ?? 0) }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .chart {
        position: relative;
      }

      .legend {
        margin-bottom: 6px;
      }

      .chart-tooltip {
        max-width: 220px;
      }
    `,
  ],
})
export class LineChart {
  readonly points = input.required<ChartPoint[]>();
  readonly series = input.required<ChartSeries[]>();
  readonly height = input(190);
  readonly valueFormat = input<ValueFormat>('number');
  /** Numero de lineas de referencia del eje Y. */
  readonly yTicks = input(4);

  protected readonly viewWidth = VIEW_WIDTH;
  protected readonly padLeft = PAD_LEFT;
  protected readonly padRight = PAD_RIGHT;
  protected readonly padTop = PAD_TOP;

  protected readonly showTable = signal(false);
  private readonly activeIndex = signal<number | null>(null);

  format(value: number): string {
    switch (this.valueFormat()) {
      case 'currency':
        return formatEuro(value);
      case 'percent':
        return formatPercent(value);
      case 'compact':
        return formatCompact(value);
      default:
        return formatNumber(value, 0);
    }
  }

  /** Escala, rejilla y trazados. Se recalcula solo si cambian los datos. */
  protected readonly geometry = computed(() => {
    const points = this.points();
    const series = this.series();
    const plotWidth = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotHeight = this.height() - PAD_TOP - PAD_BOTTOM;
    const baselineY = PAD_TOP + plotHeight;

    const allValues = points.flatMap((point) => series.map((item) => point.values[item.key] ?? 0));
    const maxValue = niceCeiling(Math.max(1, ...allValues));
    const tickCount = Math.max(2, this.yTicks());

    const gridLines = Array.from({ length: tickCount + 1 }, (_, index) => {
      const ratio = index / tickCount;
      return {
        y: PAD_TOP + plotHeight * ratio,
        label: formatCompact(maxValue * (1 - ratio)),
      };
    });

    const stepX = points.length <= 1 ? 0 : plotWidth / (points.length - 1);
    const xAt = (index: number) => PAD_LEFT + stepX * index;
    const yAt = (value: number) => baselineY - (value / maxValue) * plotHeight;

    const paths = series.map((item) => ({
      key: item.key,
      color: item.color,
      path: points
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(1)} ${yAt(point.values[item.key] ?? 0).toFixed(1)}`)
        .join(' '),
    }));

    return {
      plotWidth,
      plotHeight,
      baselineY,
      maxValue,
      gridLines,
      paths,
      xAt,
      yAt,
      xTicks: this.buildXTicks(points, xAt),
    };
  });

  /** Muestra unas pocas etiquetas del eje X para que no se solapen. */
  private buildXTicks(points: ChartPoint[], xAt: (index: number) => number) {
    if (points.length === 0) return [];

    const maxLabels = 7;
    const stride = Math.max(1, Math.ceil(points.length / maxLabels));

    return points
      .map((point, index) => ({ index, x: xAt(index), label: point.label }))
      .filter((tick) => tick.index % stride === 0 || tick.index === points.length - 1);
  }

  protected readonly active = computed(() => {
    const index = this.activeIndex();
    const points = this.points();
    if (index === null || index < 0 || index >= points.length) return null;

    const geometry = this.geometry();
    const point = points[index];

    return {
      x: geometry.xAt(index),
      label: point.label,
      leftPercent: (geometry.xAt(index) / VIEW_WIDTH) * 100,
      transform: index < 3 ? 'translateX(-12%)' : index > points.length - 4 ? 'translateX(-88%)' : 'translateX(-50%)',
      points: this.series().map((item) => ({
        key: item.key,
        color: item.color,
        y: geometry.yAt(point.values[item.key] ?? 0),
      })),
      rows: this.series().map((item) => ({
        key: item.key,
        label: item.label,
        color: item.color,
        value: this.format(point.values[item.key] ?? 0),
      })),
    };
  });

  protected readonly ariaLabel = computed(() => {
    const series = this.series().map((item) => item.label).join(' y ');
    return `Grafico de lineas de ${series} a lo largo de ${this.points().length} periodos. La tabla de datos equivalente esta disponible bajo el grafico.`;
  });

  protected onPointerMove(event: MouseEvent): void {
    const target = event.currentTarget as SVGRectElement;
    const bounds = target.getBoundingClientRect();
    const ratio = bounds.width === 0 ? 0 : (event.clientX - bounds.left) / bounds.width;
    const geometry = this.geometry();
    const count = this.points().length;

    if (count === 0) return;
    if (count === 1) {
      this.activeIndex.set(0);
      return;
    }

    const index = Math.round(ratio * (count - 1));
    void geometry;
    this.activeIndex.set(Math.min(count - 1, Math.max(0, index)));
  }

  protected clearActive(): void {
    this.activeIndex.set(null);
  }

  protected toggleTable(): void {
    this.showTable.update((value) => !value);
  }
}
