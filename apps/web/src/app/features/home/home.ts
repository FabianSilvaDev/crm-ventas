import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  JourneyStageCardComponent,
  MetricComponent,
  RecommendationCardComponent,
  SkeletonComponent,
} from '../../ui';
import {
  ActiveWorkStore,
  JourneyStore,
  RecommendationStore,
  type Recommendation,
} from '../../domain';
import { HealthService, type Probe } from '../../core/health';
import type { LivenessResponse } from '../../core/health';
import { LeadsApi, type LeadsResult } from '../../core/leads-api';
import { SessionService } from '../../core/session';
import type { Lead } from '@crm/contracts';

/**
 * Home / AI Acquisition & Growth Control Center.
 *
 * Centro de gravedad del CRM. Muestra:
 *   - saludo contextual y métrica principal (leads reales);
 *   - estado del Acquisition Journey como grid de fases;
 *   - recomendaciones del copiloto de IA con acciones de aprobación/descarte;
 *   - trabajo activo generado por recomendaciones aprobadas y leads recientes;
 *   - origen explícito de cada dato: real, demo o gap.
 *
 * ## FRONTEND DATA GAP
 *
 * El backend aún no expone resúmenes comerciales (revenue, orders, conversion,
 * ROAS, campañas activas, tareas de IA). Esta pantalla NO inventa esos números:
 *   - "Leads activos" y la lista de leads recientes vienen de `LeadsApi` (`GET /api/v1/leads`).
 *   - El estado del sistema viene de `HealthService` (`/health/live`).
 *   - El Acquisition Journey, las recomendaciones de IA y el trabajo activo son
 *     **visuales de demostración** con badge `Demo` y nota explicitando que no
 *     provienen de agentes reales.
 *
 * Cuando existan los endpoints de resumen y agentes, los stores de dominio se
 * conectarán a ellos sin reescribir la estructura visual.
 */

type AttentionSeverity = 'warning' | 'danger' | 'info';

interface AttentionItem {
  readonly id: string;
  readonly severity: AttentionSeverity;
  readonly title: string;
  readonly message: string;
  readonly actionLabel: string;
  readonly actionPath: string;
}

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    DatePipe,
    CardComponent,
    MetricComponent,
    ButtonComponent,
    BadgeComponent,
    IconComponent,
    SkeletonComponent,
    EmptyStateComponent,
    JourneyStageCardComponent,
    RecommendationCardComponent,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  readonly #session = inject(SessionService);
  readonly #leadsApi = inject(LeadsApi);
  readonly #health = inject(HealthService);
  readonly #journey = inject(JourneyStore);
  readonly #recommendations = inject(RecommendationStore);
  readonly #activeWork = inject(ActiveWorkStore);

  protected readonly loading = signal(true);
  protected readonly leadsResult = signal<LeadsResult | null>(null);
  protected readonly healthResult = signal<Probe<LivenessResponse> | null>(null);

  protected readonly journeyStages = this.#journey.stages;
  protected readonly pendingRecommendations = this.#recommendations.pendingRecommendations;
  protected readonly approvedRecommendations = this.#recommendations.approvedRecommendations;
  protected readonly activeWorkItems = this.#activeWork.items;

  /** Nombre corto para el saludo. En sesión demo no hay usuario, así que usamos un fallback neutral. */
  protected readonly userName = computed(() => {
    const user = this.#session.user();
    if (user?.email) {
      const beforeAt = user.email.split('@')[0];
      return beforeAt.charAt(0).toUpperCase() + beforeAt.slice(1);
    }
    return 'Fabian';
  });

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  });

  protected readonly activeLeads = computed(() => this.leadsResult()?.leads.length ?? 0);

  protected readonly recentLeads = computed(() => {
    const leads = this.leadsResult()?.leads ?? [];
    return leads.slice(0, 3);
  });

  protected readonly leadsUnreachable = computed(
    () => this.leadsResult()?.outcome === 'unreachable',
  );

  protected readonly attentionItems = computed<readonly AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    const health = this.healthResult();

    if (health !== null && health.outcome !== 'ok') {
      items.push({
        id: 'system-health',
        severity: 'danger',
        title: 'Sistema no responde',
        message:
          health.transportError ??
          'No pudimos confirmar que el API esté saludable. Algunos datos pueden estar desactualizados.',
        actionLabel: 'Ver estado',
        actionPath: '/sistema',
      });
    }

    if (this.leadsUnreachable()) {
      items.push({
        id: 'leads-unreachable',
        severity: 'warning',
        title: 'Leads no disponibles',
        message: 'La lista de leads no responde. Revisa que el API esté arrancado.',
        actionLabel: 'Reintentar',
        actionPath: '/home',
      });
    }

    const pending = this.#recommendations.pendingRecommendations().length;
    if (pending > 0) {
      items.push({
        id: 'ai-recommendations',
        severity: 'info',
        title: `${pending} recomendaciones de IA pendientes`,
        message: 'Revisa y aprueba las acciones que el copiloto propone para el ciclo de adquisición.',
        actionLabel: 'Ver recomendaciones',
        actionPath: '/home',
      });
    }

    return items;
  });

  /** Tasa de respuesta real: leads con `firstResponseAt` sobre el total. */
  protected readonly responseRate = computed(() => {
    const leads = this.leadsResult()?.leads ?? [];
    if (leads.length === 0) return '0%';
    const responded = leads.filter((l) => l.firstResponseAt !== null).length;
    return `${Math.round((responded / leads.length) * 100)}%`;
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);

    const [leads, health] = await Promise.all([this.#leadsApi.list(), this.#health.live()]);

    this.leadsResult.set(leads);
    this.healthResult.set(health);

    // Sincroniza el contador de ventas con los leads reales recibidos.
    this.#journey.updateCount('sales', this.activeLeads());

    this.loading.set(false);
  }

  protected onApproveRecommendation(recommendation: Recommendation): void {
    const action = this.#recommendations.approve(recommendation.id);
    if (action !== null && action.workItem !== null) {
      this.#activeWork.addFromRecommendation(action.recommendation);
      this.#journey.updateCount(recommendation.stageId, 1);
    }
  }

  protected onDismissRecommendation(recommendation: Recommendation): void {
    this.#recommendations.dismiss(recommendation.id);
  }

  protected onCompleteWork(id: string): void {
    this.#activeWork.complete(id);
  }

  protected trackByLead(_index: number, lead: Lead): string {
    return lead.id;
  }
}
