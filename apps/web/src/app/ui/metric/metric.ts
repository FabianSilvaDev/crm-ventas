import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IconComponent, type IconName } from '../icon/icon';

export type MetricTrend = 'up' | 'down' | 'flat';
export type MetricSize = 'sm' | 'md' | 'lg';

/**
 * Métrica clave: label, valor grande, hint opcional y tendencia.
 *
 * Los números usan `tabular-nums` para que las columnas de métricas sean
 * comparables a simple vista.
 */
@Component({
  selector: 'app-metric',
  imports: [IconComponent],
  templateUrl: './metric.html',
  styleUrl: './metric.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly trend = input<MetricTrend | null>(null);
  readonly trendValue = input<string | null>(null);
  readonly size = input<MetricSize>('md');

  protected readonly trendIcon = computed<IconName>(() => {
    const t = this.trend();
    if (t === 'up') return 'arrowRight';
    if (t === 'down') return 'arrowLeft';
    return 'arrowRight';
  });
}
