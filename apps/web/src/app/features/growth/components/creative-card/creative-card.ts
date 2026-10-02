import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PercentPipe } from '@angular/common';

import { CardComponent, MetricComponent } from '../../../../ui';
import { IconComponent, type IconName } from '../../../../ui/icon/icon';

export type CreativeFormat = 'image' | 'video' | 'carousel' | 'text';

export interface Creative {
  readonly id: string;
  readonly name: string;
  readonly format: CreativeFormat;
  readonly campaignName: string;
  readonly impressions: number;
  readonly ctr: number;
}

/**
 * Tarjeta de creativo publicitario.
 *
 * Visualiza el formato, la campaña asociada y las métricas de rendimiento.
 */
@Component({
  selector: 'app-creative-card',
  imports: [CardComponent, MetricComponent, IconComponent, PercentPipe],
  templateUrl: './creative-card.html',
  styleUrl: './creative-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreativeCardComponent {
  readonly creative = input.required<Creative>();

  protected readonly formatIcon = computed<IconName>(() => {
    const map: Record<CreativeFormat, IconName> = {
      image: 'products',
      video: 'campaign',
      carousel: 'analytics',
      text: 'sparkles',
    };
    return map[this.creative().format];
  });

  protected readonly formatLabel = computed(() => {
    const map: Record<CreativeFormat, string> = {
      image: 'Imagen',
      video: 'Vídeo',
      carousel: 'Carrusel',
      text: 'Texto',
    };
    return map[this.creative().format];
  });
}
