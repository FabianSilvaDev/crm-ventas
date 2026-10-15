/**
 * Centro de notificaciones compartido por el header y la vista de configuracion.
 *
 * Guarda el estado en signals para que el contador de no leidas se actualice en
 * todo el layout sin que los componentes se comuniquen entre si.
 */
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs';
import type { Notification } from '../models/insights.model';
import { NotificationsService } from './activity.service';

@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly api = inject(NotificationsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<Notification[]>([]);
  readonly unread = signal(0);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly markingAll = signal(false);
  /** Fecha de referencia de la demo, para el tiempo relativo de cada aviso. */
  readonly referenceDate = signal<string | null>(null);

  readonly hasUnread = computed(() => this.unread() > 0);

  /** Carga las notificaciones mas recientes. */
  refresh(limit = 20): void {
    this.loading.set(true);
    this.api
      .list({ limit })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.items.set(response.data);
          this.unread.set(Number(response.meta['unread'] ?? 0));
          this.total.set(Number(response.meta['total'] ?? response.data.length));
          this.referenceDate.set(response.meta.demoReferenceDate ?? null);
          this.loading.set(false);
        },
        error: () => {
          // Sin backend no hay notificaciones: el header lo indica con su propio aviso.
          this.items.set([]);
          this.unread.set(0);
          this.loading.set(false);
        },
      });
  }

  markRead(notificationId: string): void {
    this.api
      .markRead(notificationId)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items.update((items) =>
            items.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
          );
          this.unread.update((value) => Math.max(0, value - 1));
        },
      });
  }

  markAllRead(): void {
    this.markingAll.set(true);
    this.api
      .markAllRead()
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items.update((items) => items.map((item) => ({ ...item, read: true })));
          this.unread.set(0);
          this.markingAll.set(false);
        },
        error: () => this.markingAll.set(false),
      });
  }
}
