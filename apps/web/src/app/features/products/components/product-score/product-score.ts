import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type ScoreLevel = 'high' | 'medium' | 'low';

/**
 * Indicador visual de puntuación de oportunidad de producto.
 *
 * El valor numérico se comunica siempre con texto; la barra es complementaria y
 * nunca la única señal. Los rangos se ajustan según el negocio; hoy:
 *   - high  ≥ 80
 *   - medium 50–79
 *   - low   < 50
 */
@Component({
  selector: 'app-product-score',
  imports: [],
  templateUrl: './product-score.html',
  styleUrl: './product-score.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductScoreComponent {
  readonly score = input.required<number>();

  protected readonly clamped = computed(() => Math.max(0, Math.min(100, this.score())));

  protected readonly level = computed<ScoreLevel>(() => {
    const value = this.clamped();
    if (value >= 80) return 'high';
    if (value >= 50) return 'medium';
    return 'low';
  });

  protected readonly label = computed(() => {
    switch (this.level()) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Media';
      default:
        return 'Baja';
    }
  });
}
