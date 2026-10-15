/**
 * Estado de una vista: cargando, error o vacio.
 *
 * Cada vista de la aplicacion muestra este componente en lugar de dejar la pantalla
 * en blanco (seccion 14 del prompt: "Implementa estados de carga, error, vacio y
 * exito"). El error incluye un boton de reintento real, nunca decorativo.
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { NormalizedApiError } from '../../../core/models/api.model';
import { PixelIcon } from '../pixel-icon/pixel-icon';
import type { PixelIconName } from '../../pixel/icons';

@Component({
  selector: 'app-state-display',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PixelIcon],
  template: `
    <div class="state" [class.state--error]="mode() === 'error'" [class.state--empty]="mode() === 'empty'">
      @if (mode() === 'loading') {
        <span class="spinner" aria-hidden="true">
          <span class="spinner__pixel"></span>
          <span class="spinner__pixel"></span>
          <span class="spinner__pixel"></span>
        </span>
      } @else {
        <app-pixel-icon
          class="state__icon"
          [name]="icon()"
          [size]="36"
          [accent]="mode() === 'error' ? '#d03b3b' : '#8fa7b8'"
        />
      }

      <p class="state__title">{{ resolvedTitle() }}</p>
      <p class="state__text">{{ resolvedDescription() }}</p>

      @if (mode() === 'error') {
        <div class="row row--wrap" style="justify-content: center">
          <button type="button" class="btn btn--primary btn--sm" (click)="retry.emit()">
            <app-pixel-icon name="reset" [size]="12" accent="#4fd6ff" />
            Reintentar
          </button>
          @if (error()?.offline) {
            <span class="text-xs text-dim">
              Comprueba que el backend responde en <code class="text-mono">http://localhost:3000</code>
            </span>
          }
        </div>
      }
    </div>
  `,
})
export class StateDisplay {
  readonly mode = input.required<'loading' | 'error' | 'empty'>();
  readonly title = input('');
  readonly description = input('');
  readonly error = input<NormalizedApiError | null>(null);
  readonly retry = output<void>();

  readonly icon = computed<PixelIconName>(() => (this.mode() === 'error' ? 'warning' : 'cross'));

  /** Textos por defecto segun el modo, para no repetirlos en cada vista. */
  protected readonly resolvedTitle = computed(() => {
    if (this.title()) return this.title();
    if (this.mode() === 'loading') return 'Cargando datos';
    if (this.mode() === 'error') return 'No se han podido cargar los datos';
    return 'Sin resultados';
  });

  protected readonly resolvedDescription = computed(() => {
    if (this.description()) return this.description();

    const error = this.error();
    if (this.mode() === 'error') {
      return error?.message ?? 'La API ha devuelto un error inesperado.';
    }
    if (this.mode() === 'loading') {
      return 'Consultando la API simulada...';
    }
    return 'Los filtros aplicados no devuelven ningun resultado.';
  });
}
