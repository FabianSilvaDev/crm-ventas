import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CardComponent, MetricComponent } from '../../../../ui';
import { IconComponent } from '../../../../ui/icon/icon';

export interface MetricTrend {
  readonly label: string;
  readonly value: string;
  readonly previousValue: string;
  readonly trend: 'up' | 'down' | 'flat';
  readonly change: string;
  readonly hint: string;
}

/**
 * Tarjeta de métrica con comparación periodo a periodo.
 *
 * Datos de demostración hasta que exista backend de analytics.
 */
@Component({
  selector: 'app-metric-trend-card',
  imports: [CardComponent, MetricComponent],
  templateUrl: './metric-trend-card.html',
  styleUrl: './metric-trend-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricTrendCardComponent {
  readonly metric = input.required<MetricTrend>();
}
