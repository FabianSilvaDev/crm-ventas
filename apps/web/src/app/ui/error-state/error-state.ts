import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ButtonComponent } from '../button/button';
import { IconComponent } from '../icon/icon';

/**
 * Estado de error con contexto y acción de reintento.
 *
 * Distingue entre un error técnico (que puede reintentarse) y un estado vacío.
 */
@Component({
  selector: 'app-error-state',
  imports: [IconComponent, ButtonComponent],
  templateUrl: './error-state.html',
  styleUrl: './error-state.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorStateComponent {
  readonly title = input.required<string>();
  readonly detail = input<string | null>(null);
  readonly retryLabel = input('Reintentar');

  readonly retry = output<void>();
}
