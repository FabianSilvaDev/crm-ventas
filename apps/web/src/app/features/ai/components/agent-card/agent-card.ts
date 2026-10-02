import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { BadgeComponent, ButtonComponent, CardComponent, MetricComponent } from '../../../../ui';
import { IconComponent } from '../../../../ui/icon/icon';

export type AgentStatus = 'active' | 'paused' | 'offline';

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: AgentStatus;
  readonly tasksToday: number;
  readonly successRate: number;
}

/**
 * Tarjeta de agente de IA.
 *
 * Muestra estado, descripción y métricas operativas. Datos de demostración hasta
 * que exista un backend de agentes.
 */
@Component({
  selector: 'app-agent-card',
  imports: [CardComponent, BadgeComponent, ButtonComponent, MetricComponent, IconComponent],
  templateUrl: './agent-card.html',
  styleUrl: './agent-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentCardComponent {
  readonly agent = input.required<Agent>();
  readonly action = output<Agent>();

  protected readonly statusVariant = computed((): 'success' | 'warning' | 'neutral' => {
    const map: Record<AgentStatus, 'success' | 'warning' | 'neutral'> = {
      active: 'success',
      paused: 'warning',
      offline: 'neutral',
    };
    return map[this.agent().status];
  });

  protected readonly statusLabel = computed(() => {
    const map: Record<AgentStatus, string> = {
      active: 'Activo',
      paused: 'Pausado',
      offline: 'Offline',
    };
    return map[this.agent().status];
  });

  protected onAction(): void {
    this.action.emit(this.agent());
  }
}
