import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

import { BadgeComponent, ButtonComponent, CardComponent, MetricComponent } from '../../../../ui';

export type OpportunityStage =
  | 'prospecting'
  | 'discovery'
  | 'proposal'
  | 'negotiation'
  | 'closed-won'
  | 'closed-lost';

export interface Opportunity {
  readonly id: string;
  readonly name: string;
  readonly company: string;
  readonly value: number;
  readonly stage: OpportunityStage;
  readonly probability: number;
  readonly expectedClose: string;
  readonly nextAction: string;
}

/**
 * Tarjeta de oportunidad comercial.
 *
 * Datos de demostración hasta que exista un backend de pipeline/CRM.
 */
@Component({
  selector: 'app-opportunity-card',
  imports: [CardComponent, BadgeComponent, ButtonComponent, MetricComponent, CurrencyPipe],
  templateUrl: './opportunity-card.html',
  styleUrl: './opportunity-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpportunityCardComponent {
  readonly opportunity = input.required<Opportunity>();
  readonly action = output<Opportunity>();

  protected readonly stageLabel = computed(() => {
    const map: Record<OpportunityStage, string> = {
      prospecting: 'Prospección',
      discovery: 'Descubrimiento',
      proposal: 'Propuesta',
      negotiation: 'Negociación',
      'closed-won': 'Ganada',
      'closed-lost': 'Perdida',
    };
    return map[this.opportunity().stage];
  });

  protected readonly stageVariant = computed((): 'success' | 'warning' | 'info' | 'neutral' => {
    const map: Record<OpportunityStage, 'success' | 'warning' | 'info' | 'neutral'> = {
      prospecting: 'neutral',
      discovery: 'info',
      proposal: 'warning',
      negotiation: 'warning',
      'closed-won': 'success',
      'closed-lost': 'neutral',
    };
    return map[this.opportunity().stage];
  });

  protected onAction(): void {
    this.action.emit(this.opportunity());
  }
}
