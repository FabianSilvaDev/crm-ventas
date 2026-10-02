import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * Insignia de estado con texto siempre visible.
 *
 * El color no viaja solo: la etiqueta describe el estado. El punto opcional es
 * decorativo y va oculto para lectores de pantalla.
 */
@Component({
  selector: 'app-badge',
  imports: [],
  templateUrl: './badge.html',
  styleUrl: './badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('neutral');
  readonly dot = input(false, { transform: (v: boolean | string) => v === true || v === 'true' });
  readonly label = input.required<string>();

  protected classes(): string {
    return `badge badge--${this.variant()}`;
  }
}
