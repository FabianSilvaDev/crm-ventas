import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';

import { BadgeComponent, CardComponent } from '../../../../ui';
import { IconComponent, type IconName } from '../../../../ui/icon/icon';

export type AiActivityType = 'insight' | 'task' | 'automation' | 'alert';

export interface AiActivity {
  readonly id: string;
  readonly agentName: string;
  readonly type: AiActivityType;
  readonly summary: string;
  readonly detail: string;
  readonly createdAt: string;
}

/**
 * Item de actividad de IA.
 *
 * Muestra qué agente hizo qué, cuándo y con qué detalle. Datos de demostración
 * hasta que exista un backend de eventos de agentes.
 */
@Component({
  selector: 'app-ai-activity-item',
  imports: [CardComponent, BadgeComponent, IconComponent, DatePipe],
  templateUrl: './ai-activity-item.html',
  styleUrl: './ai-activity-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiActivityItemComponent {
  readonly activity = input.required<AiActivity>();

  protected readonly icon = computed<IconName>(() => {
    const map: Record<AiActivityType, IconName> = {
      insight: 'sparkles',
      task: 'checkCircle',
      automation: 'robot',
      alert: 'attention',
    };
    return map[this.activity().type];
  });

  protected readonly typeLabel = computed(() => {
    const map: Record<AiActivityType, string> = {
      insight: 'Insight',
      task: 'Tarea',
      automation: 'Automatización',
      alert: 'Alerta',
    };
    return map[this.activity().type];
  });

  protected readonly typeVariant = computed((): 'info' | 'success' | 'warning' | 'neutral' => {
    const map: Record<AiActivityType, 'info' | 'success' | 'warning' | 'neutral'> = {
      insight: 'info',
      task: 'success',
      automation: 'neutral',
      alert: 'warning',
    };
    return map[this.activity().type];
  });
}
