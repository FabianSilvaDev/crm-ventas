import { ChangeDetectionStrategy, Component } from '@angular/core';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  MetricComponent,
} from '../../ui';
import {
  AgentCardComponent,
  type Agent,
} from './components/agent-card/agent-card';
import {
  AiActivityItemComponent,
  type AiActivity,
} from './components/ai-activity-item/ai-activity-item';
import {
  AiRecommendationCardComponent,
  type AiRecommendation,
} from './components/ai-recommendation-card/ai-recommendation-card';

/**
 * AI Center — cerebro operativo de la plataforma.
 *
 * Punto central para recomendaciones de IA, actividad de agentes, agentes activos,
 * automatizaciones y uso/costos. Hoy funciona con datos de demostración
 * etiquetados; cuando existan los agentes reales y el bus de eventos, se
 * conectará sin cambiar la estructura visual.
 *
 * ## FRONTEND DATA GAP
 *
 * El backend no expone aún:
 *   - recomendaciones generadas por modelos;
 *   - actividad/historial de agentes;
 *   - estado y configuración de agentes;
 *   - automatizaciones activas;
 *   - uso de tokens y costos asociados.
 *
 * Toda esta pantalla es visual de demostración con badge `Demo`. Las acciones de
 * "aplicar recomendación" y "configurar agente" se registran como `FRONTEND DATA GAP`.
 */

@Component({
  selector: 'app-ai',
  imports: [
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    IconComponent,
    EmptyStateComponent,
    AiRecommendationCardComponent,
    AiActivityItemComponent,
    AgentCardComponent,
  ],
  templateUrl: './ai.html',
  styleUrl: './ai.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Ai {
  protected readonly recommendations: readonly AiRecommendation[] = [
    {
      id: 'rec-1',
      title: 'Aumentar presupuesto de campaña',
      what: 'La campaña "Verano 2025" muestra CPA mejorado y CTR en crecimiento.',
      why: ['CTR aumentó 31% en los últimos 7 días.', 'CPA disminuyó 18% en el mismo periodo.'],
      confidence: 82,
      impact: 'Potencialmente más conversiones con el mismo ROAS.',
      actionLabel: 'Revisar campaña',
      source: 'Agente de Growth',
    },
    {
      id: 'rec-2',
      title: 'Segmento de alto interés detectado',
      what: 'Un grupo de leads de Instagram responde 2.4x más que el promedio.',
      why: [
        '72% de este segmento abrió el primer mensaje.',
        'La conversación a oportunidad es 1.8x superior.',
      ],
      confidence: 76,
      impact: 'Crear una audiencia similar podría reducir el CPL general.',
      actionLabel: 'Ver leads',
      source: 'Agente de Research',
    },
    {
      id: 'rec-3',
      title: 'Reactivar clientes dormidos',
      what: '12 clientes no compran hace más de 60 días y abrieron el último email.',
      why: [
        'Historial de compra reciente antes del silencio.',
        'Alta tasa de apertura en campañas pasadas.',
      ],
      confidence: 64,
      impact: 'Recuperar churn con campaña de reactivación.',
      actionLabel: 'Ver clientes',
      source: 'Agente de CRM',
    },
  ];

  protected readonly activities: readonly AiActivity[] = [
    {
      id: 'act-1',
      agentName: 'GrowthBot',
      type: 'insight',
      summary: 'Detecté un segmento de alto interés',
      detail: 'Los leads de Instagram responden 2.4x más que el promedio.',
      createdAt: '2026-10-02T14:30:00.000Z',
    },
    {
      id: 'act-2',
      agentName: 'SalesAssistant',
      type: 'task',
      summary: 'Sugerí 3 seguimientos prioritarios',
      detail: 'Basado en leads sin respuesta en más de 24 horas.',
      createdAt: '2026-10-02T12:15:00.000Z',
    },
    {
      id: 'act-3',
      agentName: 'ContentAI',
      type: 'automation',
      summary: 'Generé 5 variaciones de creativo',
      detail: 'Listas para revisión humana antes de publicar.',
      createdAt: '2026-10-02T09:00:00.000Z',
    },
    {
      id: 'act-4',
      agentName: 'HealthBot',
      type: 'alert',
      summary: 'ROAS de campaña Retargeting bajó',
      detail: 'Cayó de 2.1x a 1.4x en las últimas 24 horas.',
      createdAt: '2026-10-01T22:45:00.000Z',
    },
  ];

  protected readonly agents: readonly Agent[] = [
    {
      id: 'agent-1',
      name: 'GrowthBot',
      description: 'Optimiza campañas, detecta audiencias y propone presupuestos.',
      status: 'active',
      tasksToday: 12,
      successRate: 91,
    },
    {
      id: 'agent-2',
      name: 'SalesAssistant',
      description: 'Clasifica leads, sugiere seguimientos y resume conversaciones.',
      status: 'active',
      tasksToday: 8,
      successRate: 87,
    },
    {
      id: 'agent-3',
      name: 'ContentAI',
      description: 'Genera creativos, copys y propuestas de contenido.',
      status: 'paused',
      tasksToday: 0,
      successRate: 0,
    },
  ];

  protected onRecommendationAction(recommendation: AiRecommendation): void {
    console.log(
      'FRONTEND DATA GAP: no backend endpoint to apply AI recommendation',
      recommendation.id,
    );
  }

  protected onAgentAction(agent: Agent): void {
    console.log(
      'FRONTEND DATA GAP: no backend endpoint to configure agent',
      agent.id,
    );
  }

  protected onNewAutomation(): void {
    console.log('FRONTEND DATA GAP: no backend endpoint to create automation');
  }
}
