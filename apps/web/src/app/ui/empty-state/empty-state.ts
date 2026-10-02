import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ButtonComponent } from '../button/button';
import { IconComponent, IconName } from '../icon/icon';

export type EmptyStateActionVariant = 'primary' | 'secondary' | 'ghost';

/**
 * Estado vacío accionable.
 *
 * Nunca dice solo "No data". Siempre ofrece contexto (qué falta, por qué importa)
 * y una salida (botón o enlace).
 */
@Component({
  selector: 'app-empty-state',
  imports: [IconComponent, ButtonComponent, RouterLink],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly icon = input.required<IconName>();
  readonly title = input.required<string>();
  readonly text = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);
  readonly actionPath = input<string | null>(null);
  readonly actionVariant = input<EmptyStateActionVariant>('primary');

  readonly action = output<void>();
}
