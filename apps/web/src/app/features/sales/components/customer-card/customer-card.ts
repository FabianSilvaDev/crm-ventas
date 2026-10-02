import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

import { ButtonComponent, CardComponent, MetricComponent } from '../../../../ui';
import { IconComponent } from '../../../../ui/icon/icon';

export interface Customer {
  readonly id: string;
  readonly name: string;
  readonly company: string;
  readonly ltv: number;
  readonly lastContact: string;
  readonly health: 'good' | 'at-risk' | 'churned';
}

/**
 * Tarjeta de cliente con lifetime value y estado de relación.
 *
 * Datos de demostración hasta que exista un backend de clientes.
 */
@Component({
  selector: 'app-customer-card',
  imports: [CardComponent, ButtonComponent, MetricComponent, IconComponent, CurrencyPipe],
  templateUrl: './customer-card.html',
  styleUrl: './customer-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerCardComponent {
  readonly customer = input.required<Customer>();
  readonly action = output<Customer>();

  protected readonly healthLabel = computed(() => {
    const map: Record<Customer['health'], string> = {
      good: 'Saludable',
      'at-risk': 'En riesgo',
      churned: 'Perdido',
    };
    return map[this.customer().health];
  });

  protected readonly healthClass = computed(() => {
    const map: Record<Customer['health'], string> = {
      good: 'customer-card__health--good',
      'at-risk': 'customer-card__health--at-risk',
      churned: 'customer-card__health--churned',
    };
    return map[this.customer().health];
  });

  protected onAction(): void {
    this.action.emit(this.customer());
  }
}
