import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Panel de inicio del CRM.
 *
 * Esta versión es **solo estructura visual**: los datos son estáticos y marcados como tales.
 * La etapa lógica se encargará de:
 *   - reemplazar los KPI estáticos por signals/computed alimentados por el API;
 *   - conectar el resumen de módulos con `LeadsApi`, `CampaignsApi`, etc.;
 *   - mostrar el resumen de estado del sistema desde `HealthService`;
 *   - añadir tests (`dashboard.spec.ts`).
 *
 * Hoy la pantalla dice la verdad: no hay backend que devuelva resúmenes, así que en lugar de
 * inventar números se muestran guiones y se etiqueta cada bloque con su origen real.
 */

interface ModuleMetric {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

interface Module {
  readonly label: string;
  readonly path: string | null;
  readonly icon: string;
  readonly description: string;
  readonly metrics: readonly ModuleMetric[];
  readonly state: 'active' | 'pending' | 'empty';
}

interface QuickAction {
  readonly label: string;
  readonly path: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  /** Módulos del ciclo comercial. Son estáticos hasta que exista un endpoint de resumen. */
  protected readonly modules: readonly Module[] = [
    {
      label: 'Investigación',
      path: null,
      icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m8-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm5-10a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
      description: 'Audiencias, competencia y mensajes de valor.',
      metrics: [
        { label: 'Audiencias', value: '—', hint: 'Sin datos reales' },
        { label: 'Mensajes de valor', value: '—', hint: 'Sin datos reales' },
      ],
      state: 'empty',
    },
    {
      label: 'Estrategia',
      path: null,
      icon: 'M2 12h4l3-9 6 18 3-9h4',
      description: 'Funnel, presupuesto y objetivos por canal.',
      metrics: [
        { label: 'Funnel activo', value: '—', hint: 'Sin datos reales' },
        { label: 'Presupuesto mensual', value: '—', hint: 'Sin datos reales' },
      ],
      state: 'empty',
    },
    {
      label: 'Adquisición',
      path: null,
      icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
      description: 'Campañas Meta Ads, píxeles y leads entrantes.',
      metrics: [
        { label: 'Gasto hoy', value: '—', hint: 'Sin datos reales' },
        { label: 'Leads nuevos', value: '—', hint: 'Sin datos reales' },
        { label: 'CPL', value: '—', hint: 'Sin datos reales' },
      ],
      state: 'empty',
    },
    {
      label: 'CRM / Ventas',
      path: null,
      icon: 'M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9z',
      description: 'Leads, pipeline, cotizaciones y seguimiento WhatsApp.',
      metrics: [
        { label: 'Leads activos', value: '—', hint: 'Sin datos reales' },
        { label: 'Por contactar', value: '—', hint: 'Sin datos reales' },
        { label: 'Oportunidades', value: '—', hint: 'Sin datos reales' },
      ],
      state: 'empty',
    },
    {
      label: 'Aprendizaje',
      path: null,
      icon: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z',
      description: 'Atribución, cohortes y recomendaciones de IA.',
      metrics: [
        { label: 'Cohorte activa', value: '—', hint: 'Sin datos reales' },
        { label: 'Recomendaciones IA', value: '—', hint: 'Sin datos reales' },
      ],
      state: 'empty',
    },
  ];

  protected readonly quickActions: readonly QuickAction[] = [
    { label: 'Estado del sistema', path: '/sistema' },
  ];

  /** Datos sin inventar: todo está vacío hasta que el backend exista. */
  protected readonly globalKpis: readonly { label: string; value: string; hint: string }[] = [
    { label: 'Leads hoy', value: '—', hint: 'Sin datos reales todavía' },
    { label: 'Conversaciones WhatsApp', value: '—', hint: 'Sin datos reales todavía' },
    { label: 'Ventas del mes', value: '—', hint: 'Sin datos reales todavía' },
  ];
}
