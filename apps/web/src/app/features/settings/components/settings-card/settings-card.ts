import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ButtonComponent, CardComponent, IconComponent } from '../../../../ui';
import { IconName } from '../../../../ui/icon/icon';

export interface SettingsAction {
  readonly id: string;
  readonly label: string;
  readonly primary?: boolean;
}

/**
 * Tarjeta de sección de configuración.
 *
 * Muestra icono, título, descripción, estado opcional y acciones contextuales.
 * Pensada para agrupar opciones de workspace, integraciones, proveedores de IA,
 * notificaciones, etc.
 */
@Component({
  selector: 'app-settings-card',
  imports: [CardComponent, IconComponent, ButtonComponent],
  templateUrl: './settings-card.html',
  styleUrl: './settings-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsCardComponent {
  readonly icon = input.required<IconName>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly status = input<string | null>(null);
  readonly statusVariant = input<'success' | 'warning' | 'neutral' | 'info'>('neutral');
  readonly actions = input<readonly SettingsAction[]>([]);

  readonly action = output<string>();

  protected emit(actionId: string): void {
    this.action.emit(actionId);
  }
}
