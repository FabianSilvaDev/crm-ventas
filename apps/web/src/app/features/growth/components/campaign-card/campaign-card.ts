import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CurrencyPipe, PercentPipe } from '@angular/common';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  MetricComponent,
} from '../../../../ui';
import { IconComponent } from '../../../../ui/icon/icon';

export type CampaignStatus = 'active' | 'paused' | 'ended';

export interface Campaign {
  readonly id: string;
  readonly name: string;
  readonly status: CampaignStatus;
  readonly channel: string;
  readonly budget: number;
  readonly spend: number;
  readonly leads: number;
  readonly ctr: number;
  readonly roas: number;
  readonly daysLeft: number;
}

/**
 * Tarjeta de campaña de crecimiento.
 *
 * Muestra estado, canal, presupuesto, gasto, leads, CTR, ROAS y una barra de
 * progreso de gasto. Todos los datos son visuales y deben venir del backend de
 * ads / campañas cuando exista.
 */
@Component({
  selector: 'app-campaign-card',
  imports: [
    CardComponent,
    BadgeComponent,
    MetricComponent,
    ButtonComponent,
    IconComponent,
    CurrencyPipe,
    PercentPipe,
  ],
  templateUrl: './campaign-card.html',
  styleUrl: './campaign-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignCardComponent {
  readonly campaign = input.required<Campaign>();
  readonly action = output<Campaign>();

  protected readonly statusVariant = computed(() => {
    const map: Record<CampaignStatus, 'success' | 'warning' | 'neutral'> = {
      active: 'success',
      paused: 'warning',
      ended: 'neutral',
    };
    return map[this.campaign().status];
  });

  protected readonly statusLabel = computed(() => {
    const map: Record<CampaignStatus, string> = {
      active: 'Activa',
      paused: 'Pausada',
      ended: 'Finalizada',
    };
    return map[this.campaign().status];
  });

  protected readonly spendPercent = computed(() => {
    const { spend, budget } = this.campaign();
    if (budget <= 0) return 0;
    return Math.min(100, Math.round((spend / budget) * 100));
  });

  protected onAction(): void {
    this.action.emit(this.campaign());
  }
}
