import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PercentPipe } from '@angular/common';

import { CardComponent, MetricComponent } from '../../../../ui';
import { IconComponent } from '../../../../ui/icon/icon';

export interface Audience {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly conversionRate: number;
  readonly channel: string;
}

/**
 * Lista compacta de audiencias.
 *
 * Muestra tamaño, conversión y canal de cada segmento. Diseñada para caber
 * junto a campañas sin competir visualmente con ellas.
 */
@Component({
  selector: 'app-audience-list',
  imports: [CardComponent, MetricComponent, IconComponent, PercentPipe],
  templateUrl: './audience-list.html',
  styleUrl: './audience-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudienceListComponent {
  readonly audiences = input.required<readonly Audience[]>();
}
