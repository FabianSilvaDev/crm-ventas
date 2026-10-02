import { Component } from '@angular/core';

/**
 * Módulo de Adquisición — estructura visual.
 *
 * Aquí irán las campañas Meta Ads, píxeles, eventos de conversión y leads entrantes. Hoy
 * muestra las áreas del módulo con datos vacíos y etiquetas de origen, sin inventar información.
 */

interface Section {
  readonly label: string;
  readonly icon: string;
  readonly description: string;
  readonly metrics: readonly { label: string; value: string }[];
}

@Component({
  selector: 'app-acquisition',
  imports: [],
  templateUrl: './acquisition.html',
  styleUrl: './acquisition.css',
})
export class Acquisition {
  protected readonly sections: readonly Section[] = [
    {
      label: 'Campañas',
      icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
      description: 'Campañas activas de Meta Ads con presupuesto, gasto y estado.',
      metrics: [
        { label: 'Campañas activas', value: '—' },
        { label: 'Gasto hoy', value: '—' },
      ],
    },
    {
      label: 'Píxeles y eventos',
      icon: 'M4 4h16v16H4V4zm4 4h8M8 10h8M8 14h4',
      description: 'Píxeles instalados y eventos de conversión recibidos.',
      metrics: [
        { label: 'Píxeles', value: '—' },
        { label: 'Eventos 24h', value: '—' },
      ],
    },
    {
      label: 'Leads entrantes',
      icon: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
      description: 'Personas que llegaron desde campañas y están pendientes de contacto.',
      metrics: [
        { label: 'Leads nuevos hoy', value: '—' },
        { label: 'CPL', value: '—' },
      ],
    },
  ];
}
