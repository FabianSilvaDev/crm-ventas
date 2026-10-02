import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CardComponent } from '../../../../ui';

export interface CohortWeek {
  readonly week: string;
  readonly values: readonly number[];
}

/**
 * Grid visual de cohortes.
 *
 * Muestra semanas como filas y semanas sucesivas como columnas. Datos de
 * demostración hasta que exista backend de cohortes.
 */
@Component({
  selector: 'app-cohort-grid',
  imports: [CardComponent],
  templateUrl: './cohort-grid.html',
  styleUrl: './cohort-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CohortGridComponent {
  readonly cohorts = input.required<readonly CohortWeek[]>();
  readonly weeks = input.required<readonly string[]>();

  protected readonly Math = Math;
}
