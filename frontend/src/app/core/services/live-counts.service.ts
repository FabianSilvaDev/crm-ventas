/**
 * Contadores en vivo que comparten el sidebar y el header.
 *
 * Un unico sondeo alimenta a los dos: el sidebar muestra cuantos agentes trabajan y
 * cuantos flujos avanzan, y el header repite el dato de agentes activos. Antes de
 * crear otro temporizador en un componente, este es el sitio donde anadirlo.
 */
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type Observable, forkJoin, map } from 'rxjs';
import type { AgentStatusSummary } from '../models/agents.model';
import { AgentsService } from './agents.service';
import { WorkflowsService } from './workflows.service';

/** Cada cuanto se refrescan los contadores del layout (ms). */
const REFRESH_MS = 20000;

@Injectable({ providedIn: 'root' })
export class LiveCountsService {
  private readonly agents = inject(AgentsService);
  private readonly workflows = inject(WorkflowsService);
  private readonly destroyRef = inject(DestroyRef);

  private started = false;

  readonly summary = signal<AgentStatusSummary | null>(null);
  readonly runningRuns = signal(0);
  readonly failedRuns = signal(0);
  /** Ejecuciones detenidas esperando una decision del operador. */
  readonly awaitingRuns = signal(0);

  readonly activeAgents = computed(() => this.summary()?.active ?? 0);
  readonly totalAgents = computed(() => this.summary()?.total ?? 0);
  readonly unavailableAgents = computed(() => {
    const byStatus = this.summary()?.byStatus;
    if (!byStatus) return 0;
    return (byStatus['error'] ?? 0) + (byStatus['offline'] ?? 0);
  });

  /** Arranca el sondeo periodico (una sola vez, desde el layout). */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.refresh();
    const timer = setInterval(() => this.refresh(), REFRESH_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  refresh(): void {
    const agents$: Observable<AgentStatusSummary> = this.agents
      .summary()
      .pipe(map((payload) => payload.summary));
    const running$ = this.workflows.runs({ status: 'running', pageSize: 1 });
    const failed$ = this.workflows.runs({ status: 'failed', pageSize: 1 });
    const awaiting$ = this.workflows.runs({ status: 'awaiting_approval', pageSize: 1 });

    forkJoin({ agents: agents$, running: running$, failed: failed$, awaiting: awaiting$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ agents, running, failed, awaiting }) => {
          this.summary.set(agents);
          this.runningRuns.set(Number(running.meta.total ?? 0));
          this.failedRuns.set(Number(failed.meta.total ?? 0));
          this.awaitingRuns.set(Number(awaiting.meta.total ?? 0));
        },
        error: () => {
          // Sin backend los contadores quedan a cero; el header ya avisa de la desconexion.
          this.summary.set(null);
          this.runningRuns.set(0);
          this.failedRuns.set(0);
          this.awaitingRuns.set(0);
        },
      });
  }
}
