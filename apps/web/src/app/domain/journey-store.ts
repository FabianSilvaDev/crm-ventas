import { Injectable, computed, signal } from '@angular/core';

/**
 * Estado del Acquisition Journey en el frontend.
 *
 * Cada fase representa una etapa del ciclo de adquisición y crecimiento. Los
 * contadores y estados son demo hasta que el backend exponga resúmenes por
 * fase; la estructura está lista para conectarse a APIs reales sin reescribir
 * la UI.
 */

export type JourneyStageId =
  | 'opportunity'
  | 'intelligence'
  | 'content'
  | 'campaign'
  | 'sales'
  | 'optimization'
  | 'learning';

export type JourneyStageStatus = 'healthy' | 'attention' | 'blocked' | 'empty';

export interface JourneyStage {
  readonly id: JourneyStageId;
  readonly label: string;
  readonly description: string;
  readonly status: JourneyStageStatus;
  readonly count: number;
  readonly countLabel: string;
  readonly actionLabel: string;
  readonly actionPath: string;
}

const INITIAL_STAGES: readonly JourneyStage[] = [
  {
    id: 'opportunity',
    label: 'Oportunidad',
    description: 'Productos con demanda comprobada listos para analizar.',
    status: 'attention',
    count: 3,
    countLabel: 'oportunidades',
    actionLabel: 'Ver productos',
    actionPath: '/products',
  },
  {
    id: 'intelligence',
    label: 'Inteligencia',
    description: 'Audiencias y mensajes identificados por IA.',
    status: 'attention',
    count: 1,
    countLabel: 'insight pendiente',
    actionLabel: 'Revisar',
    actionPath: '/ai',
  },
  {
    id: 'content',
    label: 'Contenido',
    description: 'Copy, creativos y landing pages en el pipeline.',
    status: 'empty',
    count: 0,
    countLabel: 'items',
    actionLabel: 'Crear contenido',
    actionPath: '/growth',
  },
  {
    id: 'campaign',
    label: 'Campañas',
    description: 'Campañas activas y su rendimiento.',
    status: 'attention',
    count: 2,
    countLabel: 'campañas activas',
    actionLabel: 'Ver campañas',
    actionPath: '/growth',
  },
  {
    id: 'sales',
    label: 'Ventas',
    description: 'Leads, oportunidades y seguimiento comercial.',
    status: 'healthy',
    count: 0,
    countLabel: 'leads activos',
    actionLabel: 'Ver leads',
    actionPath: '/sales',
  },
  {
    id: 'optimization',
    label: 'Optimización',
    description: 'Experimentos e insights de mejora.',
    status: 'healthy',
    count: 1,
    countLabel: 'ganador detectado',
    actionLabel: 'Ver experimentos',
    actionPath: '/growth',
  },
  {
    id: 'learning',
    label: 'Aprendizaje',
    description: 'Lecciones del ciclo cerrado para la siguiente iteración.',
    status: 'empty',
    count: 0,
    countLabel: 'lecciones',
    actionLabel: 'Ver analytics',
    actionPath: '/analytics',
  },
];

@Injectable({ providedIn: 'root' })
export class JourneyStore {
  readonly #stages = signal<readonly JourneyStage[]>(INITIAL_STAGES);

  readonly stages = this.#stages.asReadonly();

  readonly attentionCount = computed(
    () => this.#stages().filter((s) => s.status === 'attention' || s.status === 'blocked').length,
  );

  readonly emptyCount = computed(
    () => this.#stages().filter((s) => s.status === 'empty').length,
  );

  /**
   * Actualiza el contador de una fase. Se usa para reflejar cambios demo
   * (por ejemplo, cuando una recomendación aprobada genera trabajo activo).
   */
  updateCount(stageId: JourneyStageId, delta: number): void {
    this.#stages.update((stages) =>
      stages.map((stage) => {
        if (stage.id !== stageId) return stage;
        const nextCount = Math.max(0, stage.count + delta);
        return { ...stage, count: nextCount };
      }),
    );
  }

  /**
   * Cambia el estado de una fase. Solo para simulación visual.
   */
  setStatus(stageId: JourneyStageId, status: JourneyStageStatus): void {
    this.#stages.update((stages) =>
      stages.map((stage) => (stage.id === stageId ? { ...stage, status } : stage)),
    );
  }
}
