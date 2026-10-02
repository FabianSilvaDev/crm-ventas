import { ChangeDetectionStrategy, Component } from '@angular/core';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  MetricComponent,
} from '../../ui';
import {
  ChannelPerformanceTableComponent,
  type ChannelMetric,
} from './components/channel-performance-table/channel-performance-table';
import {
  CohortGridComponent,
  type CohortWeek,
} from './components/cohort-grid/cohort-grid';
import {
  MetricTrendCardComponent,
  type MetricTrend,
} from './components/metric-trend-card/metric-trend-card';

/**
 * Analytics — inteligencia comercial.
 *
 * Punto central para métricas comparativas, rendimiento por canal, cohortes y
 * atribución. Hoy funciona con datos de demostración etiquetados; cuando exista
 * el backend de analytics se conectará sin cambiar la estructura visual.
 *
 * ## FRONTEND DATA GAP
 *
 * El backend no expone aún:
 *   - métricas comerciales con comparación periodo a periodo;
 *   - rendimiento por canal (spend, leads, customers, revenue, ROAS);
 *   - cohortes de retención;
 *   - atribución de ventas a touchpoints;
 *   - exportación de reportes.
 *
 * Toda esta pantalla es visual de demostración con badge `Demo`. Las acciones de
 * "exportar" y "comparar" se registran como `FRONTEND DATA GAP`.
 */

interface PeriodOption {
  readonly id: string;
  readonly label: string;
}

@Component({
  selector: 'app-analytics',
  imports: [
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    IconComponent,
    EmptyStateComponent,
    MetricTrendCardComponent,
    ChannelPerformanceTableComponent,
    CohortGridComponent,
  ],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Analytics {
  protected readonly periods: readonly PeriodOption[] = [
    { id: '7d', label: '7 días' },
    { id: '30d', label: '30 días' },
    { id: '90d', label: '90 días' },
    { id: 'ytd', label: 'Año en curso' },
  ];

  protected readonly selectedPeriod = '30d';

  protected readonly trends: readonly MetricTrend[] = [
    {
      label: 'Leads',
      value: '247',
      previousValue: '198',
      trend: 'up',
      change: '+24.7%',
      hint: 'vs. periodo anterior',
    },
    {
      label: 'Clientes nuevos',
      value: '32',
      previousValue: '28',
      trend: 'up',
      change: '+14.3%',
      hint: 'vs. periodo anterior',
    },
    {
      label: 'Revenue estimado',
      value: '$14.5K',
      previousValue: '$11.2K',
      trend: 'up',
      change: '+29.5%',
      hint: 'vs. periodo anterior',
    },
    {
      label: 'CAC',
      value: '$156',
      previousValue: '$178',
      trend: 'down',
      change: '-12.4%',
      hint: 'vs. periodo anterior',
    },
  ];

  protected readonly channels: readonly ChannelMetric[] = [
    {
      channel: 'Meta Ads',
      spend: 4_530,
      leads: 213,
      customers: 18,
      revenue: 12_400,
      roas: 2.7,
    },
    {
      channel: 'Google Ads',
      spend: 980,
      leads: 34,
      customers: 4,
      revenue: 2_100,
      roas: 2.1,
    },
    {
      channel: 'Orgánico',
      spend: 0,
      leads: 89,
      customers: 7,
      revenue: 3_800,
      roas: 0,
    },
  ];

  protected readonly cohorts: readonly CohortWeek[] = [
    { week: 'S1', values: [100, 45, 30, 20] },
    { week: 'S2', values: [100, 50, 35, 22] },
    { week: 'S3', values: [100, 48, 32] },
    { week: 'S4', values: [100, 55] },
  ];

  protected readonly cohortWeeks: readonly string[] = ['W0', 'W1', 'W2', 'W3'];

  protected onExport(): void {
    console.log('FRONTEND DATA GAP: no backend endpoint to export analytics report');
  }

  protected onCompare(): void {
    console.log('FRONTEND DATA GAP: no backend endpoint for period comparison');
  }
}
