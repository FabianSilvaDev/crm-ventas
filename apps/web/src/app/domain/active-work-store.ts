import { Injectable, computed, signal } from '@angular/core';

import type { Recommendation } from './recommendation-store';

/**
 * Trabajo activo generado a partir de recomendaciones aprobadas.
 *
 * Es la representación frontend del patrón human-in-the-loop: cuando el usuario
 * aprueba una recomendación de IA, esa intención se convierte en una tarea
 * visible que puede ejecutar o descartar.
 */

export type ActiveWorkStatus = 'todo' | 'in_progress' | 'done';

export interface ActiveWorkItem {
  readonly id: string;
  readonly recommendationId: string;
  readonly title: string;
  readonly description: string;
  readonly status: ActiveWorkStatus;
  readonly path: string;
}

@Injectable({ providedIn: 'root' })
export class ActiveWorkStore {
  readonly #items = signal<readonly ActiveWorkItem[]>([]);

  readonly items = this.#items.asReadonly();

  readonly todoCount = computed(
    () => this.#items().filter((i) => i.status === 'todo' || i.status === 'in_progress').length,
  );

  readonly doneCount = computed(() => this.#items().filter((i) => i.status === 'done').length);

  /**
   * Crea un item de trabajo a partir de una recomendación aprobada.
   * Si ya existe, no hace nada (idempotente por recommendationId).
   */
  addFromRecommendation(recommendation: Recommendation): ActiveWorkItem {
    const existing = this.#items().find((i) => i.recommendationId === recommendation.id);
    if (existing) return existing;

    const item: ActiveWorkItem = {
      id: `work-${recommendation.id}`,
      recommendationId: recommendation.id,
      title: recommendation.title,
      description: `Aprobado por ${recommendation.agentName}`,
      status: 'todo',
      path: recommendation.actionPath,
    };

    this.#items.update((items) => [...items, item]);
    return item;
  }

  /**
   * Elimina un item de trabajo.
   */
  remove(id: string): void {
    this.#items.update((items) => items.filter((i) => i.id !== id));
  }

  /**
   * Marca un item como completado.
   */
  complete(id: string): void {
    this.#items.update((items) =>
      items.map((i) => (i.id === id ? { ...i, status: 'done' as const } : i)),
    );
  }

  /**
   * Marca un item como en progreso.
   */
  start(id: string): void {
    this.#items.update((items) =>
      items.map((i) => (i.id === id ? { ...i, status: 'in_progress' as const } : i)),
    );
  }
}
