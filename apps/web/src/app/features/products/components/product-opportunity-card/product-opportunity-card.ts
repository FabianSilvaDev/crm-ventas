import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { BadgeComponent, ButtonComponent, CardComponent, IconComponent } from '../../../../ui';
import { type IconName } from '../../../../ui/icon/icon';
import { ProductScoreComponent } from '../product-score/product-score';

export type DemandLevel = 'high' | 'medium' | 'low';
export type CompetitionLevel = 'high' | 'medium' | 'low';
export type TrendDirection = 'up' | 'down' | 'flat';

export interface ProductOpportunity {
  readonly id: string;
  readonly name: string;
  readonly score: number;
  readonly demand: DemandLevel;
  readonly competition: CompetitionLevel;
  readonly margin: number;
  readonly trend: TrendDirection;
  readonly trendValue: string;
  readonly aiInsight: string;
  readonly actions: readonly ProductAction[];
}

export interface ProductAction {
  readonly id: string;
  readonly label: string;
  readonly primary: boolean;
}

/**
 * Tarjeta de oportunidad de producto.
 *
 * Muestra el score, las variables de mercado, el insight de IA y las acciones
 * contextuales. Pensada para que el producto se sienta como una oportunidad
 * comercial, no como una fila de catálogo.
 */
@Component({
  selector: 'app-product-opportunity-card',
  imports: [CardComponent, BadgeComponent, ButtonComponent, IconComponent, ProductScoreComponent],
  templateUrl: './product-opportunity-card.html',
  styleUrl: './product-opportunity-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductOpportunityCardComponent {
  readonly opportunity = input.required<ProductOpportunity>();

  readonly action = output<string>();

  protected demandLabel(level: DemandLevel): string {
    switch (level) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Media';
      default:
        return 'Baja';
    }
  }

  protected competitionLabel(level: CompetitionLevel): string {
    switch (level) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Media';
      default:
        return 'Baja';
    }
  }

  protected trendIcon(direction: TrendDirection): IconName {
    return direction === 'down' ? 'trendDown' : 'trendUp';
  }

  protected badgeVariant(level: DemandLevel | CompetitionLevel): 'success' | 'warning' | 'neutral' {
    switch (level) {
      case 'high':
        return 'success';
      case 'medium':
        return 'warning';
      default:
        return 'neutral';
    }
  }
}
