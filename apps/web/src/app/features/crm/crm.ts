import { Component } from '@angular/core';

/**
 * Módulo de CRM / Ventas — estructura visual.
 *
 * Aquí irán leads, pipeline, cotizaciones y seguimiento por WhatsApp. Hoy muestra las áreas
 * del módulo con datos vacíos y etiquetas de origen, sin inventar información.
 */

interface Section {
  readonly label: string;
  readonly icon: string;
  readonly description: string;
  readonly metrics: readonly { label: string; value: string }[];
}

@Component({
  selector: 'app-crm',
  imports: [],
  templateUrl: './crm.html',
  styleUrl: './crm.css',
})
export class Crm {
  protected readonly sections: readonly Section[] = [
    {
      label: 'Leads',
      icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m8-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm5-10a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
      description: 'Base de leads con origen, estado, score y última actividad.',
      metrics: [
        { label: 'Leads activos', value: '—' },
        { label: 'Nuevos hoy', value: '—' },
      ],
    },
    {
      label: 'Pipeline',
      icon: 'M3 3h18v18H3V3zm4 4h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z',
      description: 'Etapas de venta y cuánto valor hay en cada una.',
      metrics: [
        { label: 'Oportunidades', value: '—' },
        { label: 'Valor total', value: '—' },
      ],
    },
    {
      label: 'WhatsApp',
      icon: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
      description: 'Conversaciones activas, plantillas aprobadas y respuestas pendientes.',
      metrics: [
        { label: 'Conversaciones', value: '—' },
        { label: 'Respuesta pendiente', value: '—' },
      ],
    },
    {
      label: 'Cotizaciones',
      icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 3v5h5M9 13h6M9 17h6',
      description: 'Propuestas enviadas, aprobadas y vencidas.',
      metrics: [
        { label: 'Pendientes', value: '—' },
        { label: 'Aprobadas', value: '—' },
      ],
    },
  ];
}
