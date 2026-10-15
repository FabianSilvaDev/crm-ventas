/**
 * Sparkline: una sola serie, sin ejes.
 *
 * Acompana siempre a una cifra visible (la tarjeta de indicador), asi que no
 * necesita ejes ni etiquetas: es contexto de tendencia, nunca el dato principal.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="chart__svg"
      [attr.viewBox]="'0 0 100 ' + height()"
      preserveAspectRatio="none"
      [attr.height]="height()"
      aria-hidden="true"
      focusable="false"
    >
      @if (areaPath()) {
        <path class="chart__area" [attr.d]="areaPath()" [attr.fill]="accent()" />
      }
      <path
        class="chart__line"
        [attr.d]="linePath()"
        [attr.stroke]="accent()"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .chart__svg {
        width: 100%;
      }
    `,
  ],
})
export class Sparkline {
  readonly values = input.required<number[]>();
  readonly accent = input('var(--series-1)');
  readonly height = input(26);

  private readonly geometry = computed(() => {
    const values = this.values();
    if (values.length === 0) return null;

    const max = Math.max(...values);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    const stepX = values.length === 1 ? 0 : 100 / (values.length - 1);
    const height = this.height();
    const padding = 3;

    const points = values.map((value, index) => ({
      x: index * stepX,
      y: height - padding - ((value - min) / span) * (height - padding * 2),
    }));

    return { points, height };
  });

  readonly linePath = computed(() => {
    const geometry = this.geometry();
    if (!geometry) return '';

    return geometry.points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
  });

  readonly areaPath = computed(() => {
    const geometry = this.geometry();
    if (!geometry) return '';

    const first = geometry.points[0];
    const last = geometry.points[geometry.points.length - 1];
    const line = geometry.points
      .map((point) => `L${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');

    return `M${first.x.toFixed(2)} ${geometry.height} ${line} L${last.x.toFixed(2)} ${geometry.height} Z`;
  });
}
