/**
 * Embudo de conversion.
 *
 * Las etapas ya vienen ordenadas por la API y cada barra muestra su nombre, su
 * valor y la tasa respecto a la etapa anterior como etiqueta directa: no hace
 * falta color para seguir la progresion, asi que las barras comparten un unico
 * tono y la magnitud la lleva la longitud.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatNumber, formatPercent } from '../../format/format';
import type { FunnelStep } from '../../../core/models/insights.model';

@Component({
  selector: 'app-funnel-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="funnel">
      @for (step of steps(); track step.key) {
        <div class="funnel__row">
          <span class="funnel__label">{{ step.label }}</span>
          <span class="funnel__track">
            <span class="funnel__bar" [style.width.%]="widthOf(step.value)" [style.background]="color()"></span>
          </span>
          <span class="funnel__value">
            {{ number(step.value) }}
            <span class="funnel__rate">{{ rate(step) }}</span>
          </span>
        </div>
      }
    </div>
  `,
})
export class FunnelChart {
  readonly steps = input.required<FunnelStep[]>();
  readonly color = input('var(--series-1)');

  private readonly max = computed(() => Math.max(1, ...this.steps().map((step) => step.value)));

  widthOf(value: number): number {
    return Math.max(2, Math.round((value / this.max()) * 100));
  }

  number(value: number): string {
    return formatNumber(value, 0);
  }

  /** Tasa de paso desde la etapa anterior (la primera etapa no tiene anterior). */
  rate(step: FunnelStep): string {
    if (step.stepRate >= 1) return '';
    return `· ${formatPercent(step.stepRate, 1)} del paso anterior`;
  }
}
