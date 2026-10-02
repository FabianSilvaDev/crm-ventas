import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Estado de carga con spinner accesible.
 *
 * El spinner anuncia su estado con `role="status"` para que un lector de
 * pantalla sepa que algo está en progreso.
 */
@Component({
  selector: 'app-loading-state',
  imports: [],
  templateUrl: './loading-state.html',
  styleUrl: './loading-state.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingStateComponent {
  readonly text = input('Cargando...');
}
