import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CardComponent } from '../../../../ui';

export interface ChannelMetric {
  readonly channel: string;
  readonly spend: number;
  readonly leads: number;
  readonly customers: number;
  readonly revenue: number;
  readonly roas: number;
}

/**
 * Tabla de rendimiento por canal.
 *
 * Datos de demostración hasta que exista backend de analytics.
 */
@Component({
  selector: 'app-channel-performance-table',
  imports: [CardComponent],
  templateUrl: './channel-performance-table.html',
  styleUrl: './channel-performance-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelPerformanceTableComponent {
  readonly channels = input.required<readonly ChannelMetric[]>();
}
