import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';

import { HealthService } from '../../core/health';
import type { LivenessResponse, Probe, ReadinessResponse } from '../../core/health';

type Tone = 'ok' | 'bad' | 'warn' | 'idle';

interface StatusView {
  readonly tone: Tone;
  readonly label: string;
}

@Component({
  selector: 'app-system-status',
  imports: [DatePipe],
  templateUrl: './system-status.html',
  styleUrl: './system-status.css',
})
export class SystemStatus {
  readonly #health = inject(HealthService);

  // Todo el estado en signals: Angular 22 es zoneless y una propiedad normal asignada dentro
  // de un `await` no refrescaría la vista. Ver app.config.ts.
  protected readonly live = signal<Probe<LivenessResponse> | null>(null);
  protected readonly ready = signal<Probe<ReadinessResponse> | null>(null);
  protected readonly loading = signal(false);
  protected readonly checkedAt = signal<Date | null>(null);

  protected readonly liveStatus = computed<StatusView>(() => {
    const probe = this.live();
    if (probe === null) {
      return { tone: 'idle', label: 'Comprobando' };
    }
    return probe.outcome === 'ok'
      ? { tone: 'ok', label: 'Responde' }
      : { tone: 'bad', label: 'No responde' };
  });

  protected readonly readyStatus = computed<StatusView>(() => {
    const probe = this.ready();
    if (probe === null) {
      return { tone: 'idle', label: 'Comprobando' };
    }
    if (probe.outcome === 'ok' && probe.body !== null) {
      return probe.body.status === 'ok'
        ? { tone: 'ok', label: 'Listo' }
        : { tone: 'warn', label: 'No listo' };
    }
    return { tone: 'bad', label: 'Sin respuesta' };
  });

  protected readonly liveLatency = computed(() => latencyLabel(this.live()));
  protected readonly readyLatency = computed(() => latencyLabel(this.ready()));

  constructor() {
    void this.refresh();
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);

    const [live, ready] = await Promise.all([this.#health.live(), this.#health.ready()]);

    this.live.set(live);
    this.ready.set(ready);
    this.checkedAt.set(new Date());
    this.loading.set(false);
  }
}

function latencyLabel(probe: { readonly latencyMs: number } | null): string {
  return probe === null ? '—' : `${probe.latencyMs} ms`;
}
