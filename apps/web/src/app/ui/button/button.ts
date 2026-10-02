import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent, IconName } from '../icon/icon';

/**
 * Botón del design system.
 *
 * `type="button"` por defecto para evitar envíos accidentales de formulario cuando
 * se usa fuera de un `<form>`. Sobre una superficie de marca se debe combinar con la
 * variante `secondary` o `ghost` para no perder contraste.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  imports: [IconComponent],
  templateUrl: './button.html',
  styleUrl: './button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly disabled = input(false, { transform: (v: boolean | string) => v === true || v === 'true' });
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly block = input(false, { transform: (v: boolean | string) => v === true || v === 'true' });
  readonly iconLeft = input<IconName | null>(null);
  readonly ariaLabel = input<string | null>(null);

  readonly click = output<MouseEvent>();

  protected classes(): string {
    const classes = ['btn', `btn--${this.variant()}`, `btn--${this.size()}`];

    if (this.block()) {
      classes.push('btn--block');
    }

    return classes.join(' ');
  }
}
