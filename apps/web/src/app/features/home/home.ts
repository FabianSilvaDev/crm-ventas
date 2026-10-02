import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  IconComponent,
  MetricComponent,
  SkeletonComponent,
} from '../../ui';
import { HealthService, type Probe } from '../../core/health';
import type { LivenessResponse } from '../../core/health';
import { LeadsApi, type LeadsResult } from '../../core/leads-api';
import { SessionService } from '../../core/session';
import type { Lead } from '@crm/contracts';

/**
 * Home / Business Overview.
 *
 * Punto de entrada del CRM transformado en centro de control comercial. Muestra:
 *   - saludo contextual y métrica principal;
 *   - alertas que requieren atención (salud del sistema, fallo de datos clave);
 *   - recomendaciones de IA de demostración (etiquetadas como tales);
 *   - grid de métricas secundarias con datos reales donde existen;
 *   - trabajo activo (leads recientes, campañas, tareas de IA).
 *
 * ## FRONTEND DATA GAP
 *
 * El backend aún no expone resúmenes comerciales (revenue, orders, conversion,
 * ROAS, campañas activas, tareas de IA). Esta pantalla NO inventa esos números:
 *   - "Leads activos" y la lista de leads recientes vienen de `LeadsApi` (`GET /api/v1/leads`).
 *   - El estado del sistema viene de `HealthService` (`/health/live`).
 *   - Las recomendaciones de IA son **visuales de demostración** con badge `Demo` y nota
 *     explicitando que no provienen de un agente real.
 *   - Revenue, orders, campañas y AI tasks usan empty states accionables en vez de guiones.
 *
 * Cuando existan los endpoints de resumen, este componente se conectará a ellos
 * sin reescribir la estructura visual.
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

interface AiRecommendation {
  readonly id: string;
  readonly title: string;
  readonly what: string;
  readonly why: readonly string[];
  readonly confidence: number;
  readonly impact: string;
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
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  readonly #session = inject(SessionService);
  readonly #leadsApi = inject(LeadsApi);
  readonly #health = inject(HealthService);

  protected readonly loading = signal(true);
  protected readonly leadsResult = signal<LeadsResult | null>(null);
  protected readonly healthResult = signal<Probe<LivenessResponse> | null>(null);

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

    return items;
  });

  /** Tasa de respuesta real: leads con `firstResponseAt` sobre el total. */
  protected readonly responseRate = computed(() => {
    const leads = this.leadsResult()?.leads ?? [];
    if (leads.length === 0) return '0%';
    const responded = leads.filter((l) => l.firstResponseAt !== null).length;
    return `${Math.round((responded / leads.length) * 100)}%`;
  });

  /** Recomendaciones de IA de demostración, nunca presentadas como datos reales. */
  protected readonly aiRecommendations: readonly AiRecommendation[] = [
    {
      id: 'ai-1',
      title: 'Aumentar presupuesto de campaña',
      what: 'La campaña "Verano 2025" muestra CPA mejorado y CTR en crecimiento.',
      why: ['CTR aumentó 31% en los últimos 7 días.', 'CPA disminuyó 18% en el mismo periodo.'],
      confidence: 82,
      impact: 'Potencialmente más conversiones con el mismo ROAS.',
      actionLabel: 'Revisar campaña',
      actionPath: '/growth',
    },
    {
      id: 'ai-2',
      title: 'Segmento de alto interés detectado',
      what: 'Un grupo de leads de Instagram responde 2.4x más que el promedio.',
      why: [
        '72% de este segmento abrió el primer mensaje.',
        'La conversación a oportunidad es 1.8x superior.',
      ],
      confidence: 76,
      impact: 'Crear una audiencia similar podría reducir el CPL general.',
      actionLabel: 'Ver leads',
      actionPath: '/sales',
    },
  ];

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);

    const [leads, health] = await Promise.all([this.#leadsApi.list(), this.#health.live()]);

    this.leadsResult.set(leads);
    this.healthResult.set(health);
    this.loading.set(false);
  }

  protected trackByLead(_index: number, lead: Lead): string {
    return lead.id;
  }
}
