import { Component } from '@angular/core';

/**
 * Módulo de Investigación — estructura visual.
 *
 * Aquí irán las audiencias, la competencia y los mensajes de valor. Hoy muestra las áreas del
 * módulo con datos vacíos y etiquetas de origen, sin inventar información.
 */

interface Section {
  readonly label: string;
  readonly icon: string;
  readonly description: string;
  readonly metrics: readonly { label: string; value: string }[];
}

@Component({
  selector: 'app-research',
  imports: [],
  templateUrl: './research.html',
  styleUrl: './research.css',
})
export class Research {
  protected readonly sections: readonly Section[] = [
    {
      label: 'Audiencias',
      icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m8-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm5-10a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
      description: 'Segmentos de Meta Ads definidos por intención, demografía y comportamiento.',
      metrics: [
        { label: 'Audiencias activas', value: '—' },
        { label: 'Tamaño total', value: '—' },
      ],
    },
    {
      label: 'Competencia',
      icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
      description: 'Análisis de competidores directos y mensajes que captan la misma demanda.',
      metrics: [
        { label: 'Competidores', value: '—' },
        { label: 'Alertas', value: '—' },
      ],
    },
    {
      label: 'Mensajes de valor',
      icon: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
      description: 'Propuestas de valor probadas por canal y etapa de conciencia.',
      metrics: [
        { label: 'Mensajes', value: '—' },
        { label: 'En test A/B', value: '—' },
      ],
    },
  ];
}
