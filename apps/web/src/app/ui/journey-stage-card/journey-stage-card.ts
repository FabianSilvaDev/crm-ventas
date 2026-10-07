import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BadgeComponent } from '../badge/badge';
import { CardComponent } from '../card/card';
import { IconComponent, type IconName } from '../icon/icon';
import type { JourneyStage, JourneyStageStatus } from '../../domain/journey-store';

/**
 * Tarjeta de fase del Acquisition Journey.
 *
 * Muestra el estado de una fase, su contador clave y la acción principal.
 * Pensada para el grid de Home que resume el ciclo completo.
 */
@Component({
  selector: 'app-journey-stage-card',
  imports: [CardComponent, BadgeComponent, IconComponent, RouterLink],
  templateUrl: './journey-stage-card.html',
  styleUrl: './journey-stage-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyStageCardComponent {
  readonly stage = input.required<JourneyStage>();

  protected statusLabel(status: JourneyStageStatus): string {
    switch (status) {
      case 'healthy':
        return 'En curso';
      case 'attention':
        return 'Requiere atención';
      case 'blocked':
        return 'Bloqueado';
      case 'empty':
        return 'Sin actividad';
    }
  }

  protected statusVariant(status: JourneyStageStatus): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'attention':
        return 'warning';
      case 'blocked':
        return 'danger';
      case 'empty':
        return 'neutral';
    }
  }

  protected stageIcon(id: string): IconName {
    const map: Record<string, IconName> = {
      opportunity: 'opportunity',
      intelligence: 'ai',
      content: 'sparkles',
      campaign: 'campaign',
      sales: 'sales',
      optimization: 'target',
      learning: 'analytics',
    };
    return map[id] ?? 'info';
  }
}
