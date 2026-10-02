import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';

import { BadgeComponent, ButtonComponent, CardComponent } from '../../../../ui';
import type { Lead, LeadStatus } from '@crm/contracts';

export type LeadAction = 'contact' | 'qualify' | 'convert' | 'archive';

/**
 * Tarjeta compacta de lead con acciones contextuales.
 *
 * Muestra el nombre, estado, canal, fecha de entrada y botones de acción rápida.
 * Las acciones se emiten para que la pantalla decida qué hacer; hoy se registran
 * como `FRONTEND DATA GAP` hasta que existan endpoints de CRM.
 */
@Component({
  selector: 'app-lead-card',
  imports: [CardComponent, BadgeComponent, ButtonComponent, DatePipe],
  templateUrl: './lead-card.html',
  styleUrl: './lead-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadCardComponent {
  readonly lead = input.required<Lead>();
  readonly action = output<{ leadId: string; action: LeadAction }>();

  protected readonly statusLabel = computed(() => {
    const map: Record<LeadStatus, string> = {
      NEW: 'Nuevo',
      CONTACTED: 'Contactado',
      QUALIFIED: 'Cualificado',
      UNQUALIFIED: 'No cualificado',
      CONVERTED: 'Convertido',
      LOST: 'Perdido',
    };
    return map[this.lead().status] ?? this.lead().status;
  });

  protected readonly statusVariant = computed((): 'success' | 'warning' | 'danger' | 'neutral' | 'info' => {
    const map: Record<LeadStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
      NEW: 'info',
      CONTACTED: 'warning',
      QUALIFIED: 'success',
      UNQUALIFIED: 'neutral',
      CONVERTED: 'success',
      LOST: 'danger',
    };
    return map[this.lead().status] ?? 'neutral';
  });

  protected readonly channelLabel = computed(() => {
    const map: Record<string, string> = {
      META_LEAD_FORM: 'Meta Lead Form',
      LANDING_FORM: 'Landing',
      WHATSAPP_CLICK: 'WhatsApp',
      MESSENGER: 'Messenger',
      ORGANIC: 'Orgánico',
      MANUAL: 'Manual',
    };
    return map[this.lead().channel] ?? this.lead().channel;
  });

  protected readonly initials = computed(() => {
    const name = this.lead().contactName ?? '';
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  });

  protected emit(action: LeadAction): void {
    this.action.emit({ leadId: this.lead().id, action });
  }
}
