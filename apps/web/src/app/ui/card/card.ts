import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * Contenedor de superficie elevada.
 *
 * La separación entre tarjetas la da la elevación y no el borde. En modo de alto
 * contraste forzado se recupera el borde desde `components.css` (regla global
 * `@media (forced-colors: active)`).
 */
@Component({
  selector: 'app-card',
  imports: [],
  templateUrl: './card.html',
  styleUrl: './card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  readonly padding = input<CardPadding>('md');
  readonly interactive = input(false, { transform: (v: boolean | string) => v === true || v === 'true' });

  protected classes(): string {
    return ['card', `card--padding-${this.padding()}`, this.interactive() ? 'card--interactive' : ''].join(' ');
  }
}
  