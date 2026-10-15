/**
 * Estado asincrono reutilizable: datos, carga y error.
 *
 * Seccion 14 del prompt: toda vista debe mostrar estados de carga, error, vacio y
 * exito. En lugar de repetir tres `signal()` y la suscripcion en cada componente,
 * cada vista usa esta clase y se centra en su presentacion.
 *
 * Solo mantiene viva la ultima peticion: al recargar (por un filtro o por polling)
 * cancela la anterior, y la suscripcion se cierra al destruirse el componente.
 */
import { DestroyRef, type Signal, computed, inject, signal } from '@angular/core';
import { type Observable, type Subscription, take } from 'rxjs';
import type { NormalizedApiError } from '../models/api.model';
import { isApiError } from '../services/api.service';

/** Considera vacio un resultado nulo, una lista sin elementos o un listado vacio. */
const isEmptyValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;

  if (typeof value === 'object' && 'items' in (value as Record<string, unknown>)) {
    const items = (value as { items?: unknown[] }).items;
    return Array.isArray(items) && items.length === 0;
  }

  return false;
};

export class AsyncState<T> {
  private readonly destroyRef = inject(DestroyRef);
  private current: Subscription | null = null;
  private destroyRegistered = false;

  readonly data = signal<T | null>(null);
  readonly loading = signal(false);
  readonly error = signal<NormalizedApiError | null>(null);
  /** Momento de la ultima carga correcta; util para mostrar "actualizado hace X". */
  readonly updatedAt = signal<string | null>(null);

  readonly isReady: Signal<boolean> = computed(() => !this.loading() && this.error() === null);
  readonly isEmpty: Signal<boolean> = computed(
    () => !this.loading() && this.error() === null && isEmptyValue(this.data()),
  );
  readonly hasError: Signal<boolean> = computed(() => this.error() !== null);

  /**
   * Ejecuta una peticion y actualiza el estado.
   * `keepData` conserva los datos previos mientras se recarga (filtros, refrescos).
   */
  load(source: () => Observable<T>, options: { keepData?: boolean } = {}): void {
    this.current?.unsubscribe();

    this.loading.set(true);
    this.error.set(null);
    if (!options.keepData) this.data.set(null);

    this.current = source()
      .pipe(take(1))
      .subscribe({
        next: (value) => {
          this.data.set(value);
          this.updatedAt.set(new Date().toISOString());
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            isApiError(error)
              ? error
              : {
                  status: 0,
                  code: 'UNKNOWN_ERROR',
                  message: 'Error inesperado al cargar los datos.',
                  offline: false,
                },
          );
          this.loading.set(false);
        },
      });

    if (!this.destroyRegistered) {
      this.destroyRegistered = true;
      this.destroyRef.onDestroy(() => this.current?.unsubscribe());
    }
  }

  /** Asigna datos ya disponibles (por ejemplo, tras una accion local). */
  set(value: T): void {
    this.data.set(value);
    this.updatedAt.set(new Date().toISOString());
  }

  reset(): void {
    this.current?.unsubscribe();
    this.current = null;
    this.data.set(null);
    this.error.set(null);
    this.loading.set(false);
  }
}

/** Crea un estado asincrono con tipo inferido. Debe llamarse en un contexto de inyeccion. */
export const asyncState = <T>() => new AsyncState<T>();
