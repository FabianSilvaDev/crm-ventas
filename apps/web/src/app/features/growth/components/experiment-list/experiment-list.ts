import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PercentPipe } from '@angular/common';

import { BadgeComponent, CardComponent } from '../../../../ui';
import { IconComponent } from '../../../../ui/icon/icon';

export type ExperimentStatus = 'running' | 'winner' | 'inconclusive';

export interface Experiment {
  readonly id: string;
  readonly name: string;
  readonly hypothesis: string;
  readonly status: ExperimentStatus;
  readonly variantA: string;
  readonly variantB: string;
  readonly winner: 'A' | 'B' | null;
  readonly lift: number;
}

/**
 * Lista de experimentos de crecimiento (A/B o multivariante).
 *
 * Muestra el estado, la hipótesis, las variantes y el lift del ganador cuando
 * existe.
 */
@Component({
  selector: 'app-experiment-list',
  imports: [CardComponent, BadgeComponent, IconComponent, PercentPipe],
  templateUrl: './experiment-list.html',
  styleUrl: './experiment-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExperimentListComponent {
  readonly experiments = input.required<readonly Experiment[]>();

  protected statusVariant(status: ExperimentStatus): 'success' | 'warning' | 'neutral' {
    const map: Record<ExperimentStatus, 'success' | 'warning' | 'neutral'> = {
      running: 'warning',
      winner: 'success',
      inconclusive: 'neutral',
    };
    return map[status];
  }

  protected statusLabel(status: ExperimentStatus): string {
    const map: Record<ExperimentStatus, string> = {
      running: 'En curso',
      winner: 'Ganador',
      inconclusive: 'Inconcluso',
    };
    return map[status];
  }
}
