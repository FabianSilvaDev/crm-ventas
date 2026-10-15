/**
 * Barra de progreso segmentada.
 *
 * Muestra el porcentaje como texto ademas del relleno, de modo que el dato no
 * dependa solo de la longitud de la barra. `color` acepta cualquier token o color
 * hexadecimal: se usa para el color del acento del departamento o de un estado.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatPercent } from '../../format/format';

@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="progress"
      [class.progress--sm]="size() === 'sm'"
      [class.progress--lg]="size() === 'lg'"
      role="progressbar"
      [attr.aria-valuenow]="percentValue()"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-label]="label() || 'Progreso'"
    >
      <span class="progress__fill" [style.width.%]="percentValue()" [style.color]="color()"></span>
      @if (showLabel()) {
        <span class="progress__label">{{ text() }}</span>
      }
    </div>
  `,
})
export class ProgressBar {
  /** Progreso entre 0 y 1. */
  readonly value = input.required<number>();
  readonly color = input('var(--px-cyan)');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly showLabel = input(true);
  readonly label = input('');

  readonly percentValue = computed(() => Math.round(Math.min(1, Math.max(0, this.value())) * 100));
  readonly text = computed(() => formatPercent(Math.min(1, Math.max(0, this.value())), 0));
}
