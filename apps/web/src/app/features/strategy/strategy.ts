import { Component } from '@angular/core';

/**
 * Módulo de Estrategia — estructura visual.
 *
 * Aquí irá el funnel, la asignación de presupuesto y los objetivos por canal. Hoy muestra
 * las áreas del módulo con datos vacíos y etiquetas de origen, sin inventar información.
 */

interface Section {
  readonly label: string;
  readonly icon: string;
  readonly description: string;
  readonly metrics: readonly { label: string; value: string }[];
}

@Component({
  selector: 'app-strategy',
  imports: [],
  templateUrl: './strategy.html',
  styleUrl: './strategy.css',
})
export class Strategy {
  protected readonly sections: readonly Section[] = [
    {
      label: 'Funnel',
      icon: 'M3 3h18v4H3V3zm0 6h12v4H3V9zm0 6h18v4H3v-4z',
      description: 'Etapas de conversión desde la primera impresión hasta el pago.',
      metrics: [
        { label: 'Etapas', value: '—' },
        { label: 'Conversión estimada', value: '—' },
      ],
    },
    {
      label: 'Presupuesto',
      icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
      description: 'Distribución mensual entre Meta Ads, WhatsApp y operación comercial.',
      metrics: [
        { label: 'Presupuesto mensual', value: '—' },
        { label: 'Gasto acumulado', value: '—' },
      ],
    },
    {
      label: 'Objetivos',
      icon: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 16a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0-4V7',
      description: 'Metas por canal: leads, CPL, ROAS y ventas esperadas.',
      metrics: [
        { label: 'Objetivos activos', value: '—' },
        { label: 'Cumplimiento', value: '—' },
      ],
    },
  ];
}
