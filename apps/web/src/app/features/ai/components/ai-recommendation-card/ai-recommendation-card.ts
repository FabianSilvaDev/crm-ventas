import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ButtonComponent, CardComponent, MetricComponent } from '../../../../ui';
import { IconComponent } from '../../../../ui/icon/icon';

export interface AiRecommendation {
  readonly id: string;
  readonly title: string;
  readonly what: string;
  readonly why: readonly string[];
  readonly confidence: number;
  readonly impact: string;
  readonly actionLabel: string;
  readonly source: string;
}

/**
 * Tarjeta de recomendación de IA con estructura WHAT/WHY/CONFIDENCE/ACTION.
 *
 * Todos los datos son de demostración hasta que los agentes de IA estén activos.
 */
@Component({
  selector: 'app-ai-recommendation-card',
  imports: [CardComponent, ButtonComponent, MetricComponent, IconComponent],
  templateUrl: './ai-recommendation-card.html',
  styleUrl: './ai-recommendation-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiRecommendationCardComponent {
  readonly recommendation = input.required<AiRecommendation>();
  readonly action = output<AiRecommendation>();

  protected readonly confidenceVariant = computed(() => {
    const v = this.recommendation().confidence;
    if (v >= 80) return 'success' as const;
    if (v >= 60) return 'warning' as const;
    return 'neutral' as const;
  });

  protected onAction(): void {
    this.action.emit(this.recommendation());
  }
}
