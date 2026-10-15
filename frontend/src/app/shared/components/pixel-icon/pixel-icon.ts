/**
 * Icono pixel art.
 *
 * Renderiza una matriz de pixeles como SVG en linea (via `data:` URI), de modo que
 * hereda el aspecto pixelado del proyecto sin cargar imagenes. El propio SVG es
 * accesible: si se pasa `label` el icono se anuncia, y si no, se oculta a los
 * lectores de pantalla porque siempre acompana a un texto visible.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type SpriteTheme, toDataUri } from '../../pixel/pixel-art';
import { ICONS, type PixelIconName } from '../../pixel/icons';

@Component({
  selector: 'app-pixel-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img
      class="pixel-icon"
      [src]="uri()"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [attr.alt]="label() || null"
      [attr.aria-hidden]="label() ? null : 'true'"
    />
  `,
  styles: [
    `
      .pixel-icon {
        display: block;
        image-rendering: pixelated;
        flex: 0 0 auto;
      }
    `,
  ],
})
export class PixelIcon {
  readonly name = input.required<PixelIconName>();
  readonly size = input(16);
  /** Nombre del acento (color del departamento) o un color hexadecimal. */
  readonly accent = input<string>('cyan');
  /** Texto alternativo; si falta, el icono queda decorativo. */
  readonly label = input('');

  readonly uri = computed(() => {
    const theme: SpriteTheme = { accent: this.accent() };
    return toDataUri(ICONS[this.name()], theme, { title: this.label() || undefined });
  });
}
