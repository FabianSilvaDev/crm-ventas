import { Injectable, computed, signal } from '@angular/core';

import type { ActiveWorkItem } from './active-work-store';

/**
 * Recomendaciones del copiloto de IA.
 *
 * Hoy el frontend muestra recomendaciones de demostración que representan lo que
 * los agentes entregarán cuando estén activos. Cada recomendación puede ser:
 *   - `pending`: esperando revisión humana.
 *   - `approved`: aprobada; genera trabajo activo.
 *   - `dismissed`: descartada; desaparece del feed.
 */

export type RecommendationStatus = 'pending' | 'approved' | 'dismissed';
export type RecommendationImpact = 'high' | 'medium' | 'low';

export interface Recommendation {
  readonly id: string;
  readonly agentId: string;
  readonly agentName: string;
  readonly title: string;
  readonly what: string;
  readonly why: readonly string[];
  readonly confidence: number;
  readonly impact: RecommendationImpact;
  readonly impactDescription: string;
  readonly actionLabel: string;
  readonly actionPath: string;
  /** Fase del journey a la que pertenece; permite actualizar contadores. */
  readonly stageId: 'opportunity' | 'intelligence' | 'content' | 'campaign' | 'sales' | 'optimization';
  readonly status: RecommendationStatus;
}

export interface RecommendationAction {
  readonly type: 'approve' | 'dismiss';
  readonly recommendation: Recommendation;
  readonly workItem: ActiveWorkItem | null;
}

const INITIAL_RECOMMENDATIONS: readonly Recommendation[] = [
  {
    id: 'rec-rolex-submarino',
    agentId: 'product_research',
    agentName: 'Product Research',
    title: 'Lanzar campaña para Rolex Submariner azul',
    what: 'Oportunidad con score 91, demanda alta y margen estimado del 65%.',
    why: ['La búsqueda de réplicas de lujo creció 41% este mes.', 'Competencia media: hay espacio para posicionamiento premium.'],
    confidence: 91,
    impact: 'high',
    impactDescription: 'Potencial de alto margen con volumen de nicho sostenido.',
    actionLabel: 'Ver oportunidad',
    actionPath: '/products',
    stageId: 'opportunity',
    status: 'pending',
  },
  {
    id: 'rec-1',
    agentId: 'campaign_manager',
    agentName: 'Campaign Manager',
    title: 'Aumentar presupuesto de Verano 2025',
    what: 'La campaña muestra CPA mejorado y CTR en crecimiento.',
    why: ['CTR aumentó 31% en los últimos 7 días.', 'CPA disminuyó 18% en el mismo periodo.'],
    confidence: 82,
    impact: 'high',
    impactDescription: 'Potencialmente más conversiones con el mismo ROAS.',
    actionLabel: 'Revisar campaña',
    actionPath: '/growth',
    stageId: 'campaign',
    status: 'pending',
  },
  {
    id: 'rec-2',
    agentId: 'product_research',
    agentName: 'Product Research',
    title: 'Validar oportunidad de auriculares premium',
    what: 'Oportunidad con score 87, demanda alta y competencia media.',
    why: ['Margen estimado del 32%.', 'Tendencia de búsqueda al alza.'],
    confidence: 87,
    impact: 'medium',
    impactDescription: 'Nuevo SKU con buen ratio riesgo/retorno.',
    actionLabel: 'Ver oportunidad',
    actionPath: '/products',
    stageId: 'opportunity',
    status: 'pending',
  },
  {
    id: 'rec-3',
    agentId: 'marketing_strategy',
    agentName: 'Marketing Strategy',
    title: 'Crear lookalike del segmento de Instagram',
    what: 'Un grupo de leads de Instagram responde 2.4x más que el promedio.',
    why: ['72% abrió el primer mensaje.', 'Conversión a oportunidad 1.8x superior.'],
    confidence: 76,
    impact: 'medium',
    impactDescription: 'Reducir el CPL general con una audiencia similar.',
    actionLabel: 'Ver leads',
    actionPath: '/sales',
    stageId: 'intelligence',
    status: 'pending',
  },
];

@Injectable({ providedIn: 'root' })
export class RecommendationStore {
  readonly #recommendations = signal<readonly Recommendation[]>(INITIAL_RECOMMENDATIONS);

  readonly recommendations = this.#recommendations.asReadonly();

  readonly pendingRecommendations = computed(() =>
    this.#recommendations().filter((r) => r.status === 'pending'),
  );

  readonly approvedRecommendations = computed(() =>
    this.#recommendations().filter((r) => r.status === 'approved'),
  );

  readonly dismissedCount = computed(
    () => this.#recommendations().filter((r) => r.status === 'dismissed').length,
  );

  /**
   * Aprueba una recomendación y devuelve la acción con un item de trabajo.
   */
  approve(id: string): RecommendationAction | null {
    let action: RecommendationAction | null = null;

    this.#recommendations.update((list) =>
      list.map((rec) => {
        if (rec.id !== id || rec.status !== 'pending') return rec;

        const workItem: ActiveWorkItem = {
          id: `work-${rec.id}`,
          recommendationId: rec.id,
          title: rec.title,
          description: `Aprobado por ${rec.agentName}`,
          status: 'todo',
          path: rec.actionPath,
        };

        action = { type: 'approve', recommendation: { ...rec, status: 'approved' }, workItem };
        return { ...rec, status: 'approved' };
      }),
    );

    return action;
  }

  /**
   * Descarta una recomendación; no genera trabajo activo.
   */
  dismiss(id: string): RecommendationAction | null {
    let action: RecommendationAction | null = null;

    this.#recommendations.update((list) =>
      list.map((rec) => {
        if (rec.id !== id || rec.status !== 'pending') return rec;
        action = { type: 'dismiss', recommendation: { ...rec, status: 'dismissed' }, workItem: null };
        return { ...rec, status: 'dismissed' };
      }),
    );

    return action;
  }

  /**
   * Marca una recomendación como vista sin cambiar su estado.
   */
  viewMore(id: string): Recommendation | null {
    return this.#recommendations().find((rec) => rec.id === id) ?? null;
  }
}
