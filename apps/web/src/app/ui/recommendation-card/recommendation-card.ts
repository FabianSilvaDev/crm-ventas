import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BadgeComponent } from '../badge/badge';
import { ButtonComponent } from '../button/button';
import { CardComponent } from '../card/card';
import { IconComponent } from '../icon/icon';
import type { Recommendation, RecommendationImpact } from '../../domain/recommendation-store';

/**
 * Tarjeta de recomendación del copiloto de IA.
 *
 * Muestra la propuesta, la evidencia, el impacto esperado y las acciones de
 * aprobación / descarte. Implementa el patrón human-in-the-loop: la IA
 * recomienda, el humano decide.
 */
@Component({
  selector: 'app-recommendation-card',
  imports: [CardComponent, BadgeComponent, ButtonComponent, IconComponent, RouterLink],
  templateUrl: './recommendation-card.html',
  styleUrl: './recommendation-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationCardComponent {
  readonly recommendation = input.required<Recommendation>();

  readonly approve = output<Recommendation>();
  readonly dismiss = output<Recommendation>();
  readonly viewMore = output<Recommendation>();

  protected impactLabel(impact: RecommendationImpact): string {
    switch (impact) {
      case 'high':
        return 'Alto impacto';
      case 'medium':
        return 'Impacto medio';
      default:
        return 'Impacto bajo';
    }
  }

  protected impactVariant(impact: RecommendationImpact): 'success' | 'warning' | 'neutral' {
    switch (impact) {
      case 'high':
        return 'success';
      case 'medium':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  protected onApprove(): void {
    this.approve.emit(this.recommendation());
  }

  protected onDismiss(): void {
    this.dismiss.emit(this.recommendation());
  }

  protected onViewMore(): void {
    this.viewMore.emit(this.recommendation());
  }
}
