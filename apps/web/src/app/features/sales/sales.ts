import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  MetricComponent,
  SkeletonComponent,
} from '../../ui';
import { LeadsApi, type LeadsResult } from '../../core/leads-api';
import type { Lead } from '@crm/contracts';

import {
  CustomerCardComponent,
  type Customer,
} from './components/customer-card/customer-card';
import {
  FollowUpListComponent,
  type FollowUp,
} from './components/follow-up-list/follow-up-list';
import {
  LeadCardComponent,
  type LeadAction,
} from './components/lead-card/lead-card';
import {
  OpportunityCardComponent,
  type Opportunity,
} from './components/opportunity-card/opportunity-card';

/**
 * Sales / CRM — centro comercial.
 *
 * Punto central para leads, oportunidades, clientes y seguimientos. Conecta con
 * datos reales de leads vía `LeadsApi` y complementa con datos de demostración
 * para pipeline, oportunidades, clientes y tareas de seguimiento.
 *
 * ## FRONTEND DATA GAP
 *
 * El backend expone `GET /api/v1/leads`, así que conteos, tasa de respuesta y la
 * lista de leads recientes son reales. No expone aún:
 *   - pipeline de oportunidades con valor y probabilidad;
 *   - clientes, LTV y estado de relación;
 *   - órdenes/pedidos;
 *   - tareas de seguimiento programadas;
 *   - acciones de contactar, cualificar, convertir o archivar un lead.
 *
 * Esos elementos se muestran como datos de demostración con badge `Demo`, estados
 * vacíos accionables y acciones que se registran como `FRONTEND DATA GAP`.
 */

interface PipelineStage {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly value: number;
}

interface SalesAction {
  readonly leadId: string;
  readonly action: LeadAction;
}

@Component({
  selector: 'app-sales',
  imports: [
    RouterLink,
    CurrencyPipe,
    CardComponent,
    MetricComponent,
    ButtonComponent,
    BadgeComponent,
    IconComponent,
    SkeletonComponent,
    EmptyStateComponent,
    LeadCardComponent,
    OpportunityCardComponent,
    CustomerCardComponent,
    FollowUpListComponent,
  ],
  templateUrl: './sales.html',
  styleUrl: './sales.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sales {
  readonly #leadsApi = inject(LeadsApi);

  protected readonly loading = signal(true);
  protected readonly result = signal<LeadsResult | null>(null);

  protected readonly activeLeads = computed(() => this.result()?.leads.length ?? 0);

  protected readonly responseRate = computed(() => {
    const leads = this.result()?.leads ?? [];
    if (leads.length === 0) return '0%';
    const responded = leads.filter((l) => l.firstResponseAt !== null).length;
    return `${Math.round((responded / leads.length) * 100)}%`;
  });

  protected readonly recentLeads = computed(() => {
    const leads = this.result()?.leads ?? [];
    return leads.slice(0, 3);
  });

  protected readonly pipeline: readonly PipelineStage[] = [
    { id: 'new', label: 'Nuevo', count: 8, value: 0 },
    { id: 'contacted', label: 'Contactado', count: 5, value: 12_000 },
    { id: 'qualified', label: 'Cualificado', count: 3, value: 45_000 },
    { id: 'proposal', label: 'Propuesta', count: 2, value: 78_000 },
    { id: 'closed', label: 'Cerrado', count: 4, value: 156_000 },
  ];

  protected readonly opportunities: readonly Opportunity[] = [
    {
      id: 'op-1',
      name: 'Distribuidora Norte',
      company: 'Distribuidora Norte S.A.',
      value: 45_000,
      stage: 'proposal',
      probability: 60,
      expectedClose: '15/11',
      nextAction: 'Enviar propuesta formal',
    },
    {
      id: 'op-2',
      name: 'Cadena Retail Sur',
      company: 'Retail Sur S.A.S.',
      value: 120_000,
      stage: 'negotiation',
      probability: 40,
      expectedClose: '30/11',
      nextAction: 'Reunión con compras',
    },
    {
      id: 'op-3',
      name: 'Startup TechLocal',
      company: 'TechLocal SAS',
      value: 18_000,
      stage: 'discovery',
      probability: 25,
      expectedClose: '10/12',
      nextAction: 'Demo personalizada',
    },
  ];

  protected readonly customers: readonly Customer[] = [
    {
      id: 'cust-1',
      name: 'Carlos Ruiz',
      company: 'ElectroSur',
      ltv: 120_000,
      lastContact: 'Hace 3 días',
      health: 'good',
    },
    {
      id: 'cust-2',
      name: 'María López',
      company: 'Moda Urbana',
      ltv: 74_000,
      lastContact: 'Hace 12 días',
      health: 'at-risk',
    },
    {
      id: 'cust-3',
      name: 'Jorge Torres',
      company: 'Industrias PTY',
      ltv: 210_000,
      lastContact: 'Hace 1 mes',
      health: 'good',
    },
  ];

  protected readonly followUps: readonly FollowUp[] = [
    {
      id: 'fu-1',
      leadName: 'Ana Pérez',
      type: 'call',
      subject: 'Llamar para confirmar interés',
      dueAt: '2026-10-03T10:00:00.000Z',
      overdue: true,
    },
    {
      id: 'fu-2',
      leadName: 'Luis Gómez',
      type: 'email',
      subject: 'Enviar propuesta',
      dueAt: '2026-10-04T14:00:00.000Z',
      overdue: false,
    },
    {
      id: 'fu-3',
      leadName: 'TechLocal SAS',
      type: 'meeting',
      subject: 'Demo personalizada',
      dueAt: '2026-10-05T16:00:00.000Z',
      overdue: false,
    },
  ];

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.result.set(await this.#leadsApi.list());
    this.loading.set(false);
  }

  protected trackByLead(_index: number, lead: Lead): string {
    return lead.id;
  }

  protected onLeadAction(event: SalesAction): void {
    console.log(
      'FRONTEND DATA GAP: no backend endpoint for lead action',
      event.action,
      event.leadId,
    );
  }

  protected onOpportunityAction(opportunity: Opportunity): void {
    console.log(
      'FRONTEND DATA GAP: no backend endpoint to view/manage opportunity',
      opportunity.id,
    );
  }

  protected onCustomerAction(customer: Customer): void {
    console.log(
      'FRONTEND DATA GAP: no backend endpoint to view customer',
      customer.id,
    );
  }

  protected onCreateDeal(): void {
    console.log('FRONTEND DATA GAP: no backend endpoint to create a deal');
  }
}
