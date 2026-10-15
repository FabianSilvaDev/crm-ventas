/**
 * Estado de conexion con la API.
 *
 * El header muestra un indicador permanente (seccion 6 del prompt) y varias vistas
 * necesitan los parametros de simulacion que publica el health check. El sondeo se
 * inicia una sola vez, desde el layout, y se detiene al destruirse.
 */
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type Observable, interval, take } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiHealth } from '../models/insights.model';
import { ApiService } from './api.service';

export type ConnectionState = 'checking' | 'online' | 'offline';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private started = false;

  readonly connection = signal<ConnectionState>('checking');
  readonly health = signal<ApiHealth | null>(null);
  readonly lastCheckedAt = signal<string | null>(null);

  /** Parametros de simulacion publicados por la API (o los del entorno). */
  readonly simulation = computed(
    () =>
      this.health()?.simulation ?? {
        stepMs: 4200,
        taskMs: 2600,
        failureRate: 0.03,
        pollIntervalMs: environment.defaultPollIntervalMs,
      },
  );

  readonly isOnline = computed(() => this.connection() === 'online');

  /** Arranca el sondeo periodico. Debe llamarse desde un contexto de inyeccion. */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.check();
    interval(environment.healthCheckIntervalMs)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.check());
  }

  /** Consulta puntual del estado; tambien sirve como reintento manual. */
  check(): void {
    this.connection.set(this.health() === null ? 'checking' : this.connection());

    this.api
      .getData<ApiHealth>('/health')
      .pipe(take(1))
      .subscribe({
        next: (health) => {
          this.health.set(health);
          this.connection.set('online');
          this.lastCheckedAt.set(new Date().toISOString());
        },
        error: () => {
          this.health.set(null);
          this.connection.set('offline');
          this.lastCheckedAt.set(new Date().toISOString());
        },
      });
  }

  /** Comprueba si la API responde; usado antes de lanzar acciones con efecto. */
  ping(): Observable<ApiHealth> {
    return this.api.getData<ApiHealth>('/health');
  }
}
