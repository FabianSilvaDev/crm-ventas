import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type SkeletonVariant = 'text' | 'title' | 'block' | 'circle' | 'button';

/**
 * Placeholder animado para estados de carga.
 *
 * La animación se respeta `prefers-reduced-motion`: quienes la hayan pedido no
 * ven movimiento.
 */
@Component({
  selector: 'app-skeleton',
  imports: [],
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonComponent {
  readonly variant = input<SkeletonVariant>('text');
  readonly width = input<string | null>(null);
  readonly height = input<string | null>(null);

  protected classes(): string {
    return `skeleton skeleton--${this.variant()}`;
  }

  protected styles(): Record<string, string> {
    const styles: Record<string, string> = {};
    const w = this.width();
    const h = this.height();

    if (w !== null) styles['width'] = w;
    if (h !== null) styles['height'] = h;

    return styles;
  }
}
