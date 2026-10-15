/**
 * Tarjeta de indicador (KPI).
 *
 * Un indicador con un unico valor no necesita un grafico: la cifra grande es el
 * mensaje. El sparkline es opcional y solo se usa para dar contexto de tendencia,
 * nunca para sustituir al numero.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PixelIcon, } from '../pixel-icon/pixel-icon';
import type { PixelIconName } from '../../pixel/icons';
import { Sparkline } from '../sparkline/sparkline';

@Component({
  selector: 'app-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PixelIcon, Sparkline],
  template: `
    <article class="stat">
      <header class="stat__label">
        <app-pixel-icon [name]="icon()" [size]="12" [accent]="accent()" />
        {{ label() }}
      </header>

      <p class="stat__value">
        {{ value() }}
        @if (unit()) {
          <span class="stat__unit">{{ unit() }}</span>
        }
      </p>

      @if (trend(); as points) {
        <app-sparkline class="stat__spark" [values]="points" [accent]="accent()" />
      }

      @if (hint()) {
        <p class="stat__meta">{{ hint() }}</p>
      }
    </article>
  `,
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly unit = input('');
  readonly hint = input('');
  readonly icon = input<PixelIconName>('grid');
  readonly accent = input('cyan');
  /** Serie opcional para el sparkline. */
  readonly trend = input<number[] | null>(null);
}
