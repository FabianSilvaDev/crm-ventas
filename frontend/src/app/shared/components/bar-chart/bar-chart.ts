/**
 * Barras horizontales para comparar una magnitud entre categorias.
 *
 * Es un grafico de UNA sola serie: la magnitud la lleva la longitud de la barra y
 * la identidad la lleva el nombre de la categoria, asi que el color no codifica
 * nada y no procede una leyenda ni una paleta categorica (usar ocho colores para
 * ocho categorias de la misma medida seria un error de codificacion).
 *
 * Cada barra lleva su valor como etiqueta directa, de modo que no hay que estimar
 * longitudes ni pasar el raton.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatCompact, formatEuro, formatNumber, formatPercent } from '../../format/format';
import type { ValueFormat } from '../line-chart/line-chart';

export interface BarRow {
  label: string;
  value: number;
  /** Texto secundario opcional (por ejemplo, el numero de elementos). */
  note?: string;
}

@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hbars">
      @for (row of rows(); track row.label) {
        <div class="hbar">
          <span class="hbar__name" [title]="row.label">{{ row.label }}</span>
          <span class="hbar__track">
            <span class="hbar__fill" [style.width.%]="widthOf(row.value)" [style.background]="color()"></span>
          </span>
          <span class="hbar__value">
            {{ format(row.value) }}
            @if (row.note) {
              <span class="text-xs text-dim"> · {{ row.note }}</span>
            }
          </span>
        </div>
      }
    </div>
  `,
})
export class BarChart {
  readonly rows = input.required<BarRow[]>();
  readonly color = input('var(--series-1)');
  readonly valueFormat = input<ValueFormat>('number');

  private readonly max = computed(() => Math.max(1, ...this.rows().map((row) => row.value)));

  /** Ancho relativo al valor maximo; el minimo visible es 2% para no perder la barra. */
  widthOf(value: number): number {
    return Math.max(2, Math.round((value / this.max()) * 100));
  }

  format(value: number): string {
    switch (this.valueFormat()) {
      case 'currency':
        return formatEuro(value);
      case 'percent':
        return formatPercent(value);
      case 'compact':
        return formatCompact(value);
      default:
        return formatNumber(value, 0);
    }
  }
}
