/**
 * Dashboard: estado general de la operacion.
 *
 * Todos los indicadores vienen de `GET /api/v1/dashboard`; la vista no calcula
 * cifras nuevas salvo las derivadas de presentacion (etiquetas de etapa del embudo
 * y nombres de departamento), y siempre a partir de los datos de la API.
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import type { ApiResponse } from '../../core/models/api.model';
import type { Department, DepartmentRef } from '../../core/models/agents.model';
import type { Dashboard, FunnelStep } from '../../core/models/insights.model';
import { LEAD_STATUS_LABEL } from '../../core/models/labels';
import { DashboardService } from '../../core/services/dashboard.service';
import { DepartmentsService } from '../../core/services/departments.service';
import { AsyncState } from '../../core/util/async-state';
import { BarChart, type BarRow } from '../../shared/components/bar-chart/bar-chart';
import { FunnelChart } from '../../shared/components/funnel-chart/funnel-chart';
import { LineChart, type ChartPoint, type ChartSeries } from '../../shared/components/line-chart/line-chart';
import { PixelIcon } from '../../shared/components/pixel-icon/pixel-icon';
import { ProgressBar } from '../../shared/components/progress-bar/progress-bar';
import { StatTile } from '../../shared/components/stat-tile/stat-tile';
import { StateDisplay } from '../../shared/components/state-display/state-display';
import { StatusChip } from '../../shared/components/status-chip/status-chip';
import { formatEuro, formatNumber, formatPercent } from '../../shared/format/format';
import { DateEsPipe, EuroPipe, PercentPipe, TimeAgoPipe } from '../../shared/pipes/format.pipes';

interface DashboardView {
  dashboard: Dashboard;
  referenceDate: string | null;
  departmentNames: Record<string, DepartmentRef>;
}

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    BarChart,
    FunnelChart,
    LineChart,
    PixelIcon,
    ProgressBar,
    StatTile,
    StateDisplay,
    StatusChip,
    DateEsPipe,
    EuroPipe,
    PercentPipe,
    TimeAgoPipe,
  ],
  templateUrl: './dashboard.html',
  styles: [
    `
      .health-signals {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .health-signal {
        display: grid;
        grid-template-columns: 14px minmax(0, 1fr) auto;
        gap: 10px;
        align-items: start;
        padding: 9px 11px;
        background: var(--px-surface-1);
        border: 2px solid var(--px-line);
        text-decoration: none;
        color: inherit;
      }

      .health-signal:hover {
        border-color: var(--px-line-strong);
        text-decoration: none;
      }

      .health-signal__title {
        font-size: 12.5px;
        font-weight: 600;
      }

      .health-signal__detail {
        font-size: 11.5px;
        color: var(--px-ink-muted);
      }

      .task-row {
        display: grid;
        grid-template-columns: 30px minmax(0, 1fr) 120px 84px;
        gap: 10px;
        align-items: center;
        padding: 8px 12px;
        border-bottom: 1px solid var(--px-line);
      }

      .task-row:last-child {
        border-bottom: 0;
      }

      @media (max-width: 900px) {
        .task-row {
          grid-template-columns: 30px minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class DashboardPage {
  private readonly dashboardService = inject(DashboardService);
  private readonly departmentsService = inject(DepartmentsService);

  protected readonly state = new AsyncState<DashboardView>();

  constructor() {
    this.load();
  }

  /** Peticion del dashboard: indicadores y nombres de departamento en una sola carga. */
  private source() {
    return forkJoin({
      response: this.dashboardService.getDashboard(),
      departments: this.departmentsService.list(),
    }).pipe(
      map(({ response, departments }) => ({
        dashboard: response.data,
        referenceDate: response.meta.demoReferenceDate ?? null,
        departmentNames: Object.fromEntries(
          (departments.data as Department[]).map((department) => [
            department.id,
            { id: department.id, name: department.name, shortName: department.shortName, accent: department.accent },
          ]),
        ),
      })),
    );
  }

  protected load(): void {
    this.state.load(() => this.source());
  }

  /** Recarga conservando los datos en pantalla, para que la vista no parpadee. */
  protected refresh(): void {
    this.state.load(() => this.source(), { keepData: true });
  }

  /** Accesos rapidos a las partes de la respuesta, ya con el estado resuelto. */
  protected readonly kpis = computed(() => this.state.data()?.dashboard.kpis ?? null);
  protected readonly health = computed(() => this.state.data()?.dashboard.operationHealth ?? null);
  protected readonly charts = computed(() => this.state.data()?.dashboard.charts ?? null);
  protected readonly activity = computed(() => this.state.data()?.dashboard.recentActivity ?? []);
  protected readonly tasks = computed(() => this.state.data()?.dashboard.latestTasks ?? []);
  protected readonly referenceDate = computed(() => this.state.data()?.referenceDate ?? null);
  protected readonly demo = computed(() => this.state.data()?.dashboard.demo ?? null);

  // --- Series de los graficos -------------------------------------------------

  /** Una sola serie: no procede leyenda, el titulo del panel la nombra. */
  protected readonly leadsSeries = computed<ChartPoint[]>(
    () => this.charts()?.leadsSeries.map((point) => ({ label: point.label, values: { leads: point.value } })) ?? [],
  );

  protected readonly leadsSeriesDef = computed<ChartSeries[]>(() => [
    { key: 'leads', label: 'Leads captados', color: 'var(--series-1)' },
  ]);

  /** Dos series comparables (mismo eje, misma unidad): ingreso y gasto. */
  protected readonly revenueSeries = computed<ChartPoint[]>(
    () =>
      this.charts()?.revenueSeries.map((point) => ({
        label: point.label,
        values: { revenue: point.revenue, spend: point.spend },
      })) ?? [],
  );

  protected readonly revenueSeriesDef = computed<ChartSeries[]>(() => [
    { key: 'revenue', label: 'Ingreso simulado', color: 'var(--series-1)' },
    { key: 'spend', label: 'Gasto', color: 'var(--series-2)' },
  ]);

  /** Una medida por departamento: un unico tono y el nombre como identidad. */
  protected readonly workloadRows = computed<BarRow[]>(() => {
    const names = this.state.data()?.departmentNames ?? {};
    return (this.charts()?.departmentWorkload ?? [])
      .map((row) => ({
        label: names[row.departmentId]?.shortName ?? row.departmentId,
        value: row.tasksCompleted,
        note: `${row.active} activos`,
      }))
      .sort((a, b) => b.value - a.value);
  });

  /** Embudo del estado comercial, en el orden natural del proceso. */
  protected readonly funnel = computed<FunnelStep[]>(() => {
    const funnel = this.charts()?.leadFunnel;
    if (!funnel) return [];

    const order = ['new', 'contacted', 'qualified', 'proposal', 'won'] as const;
    let previous: number | null = null;

    return order.map((status) => {
      const value = funnel[status] ?? 0;
      const stepRate = previous === null || previous === 0 ? 1 : value / previous;
      previous = value;

      return {
        key: status,
        label: LEAD_STATUS_LABEL[status],
        value,
        stepRate,
      };
    });
  });

  protected readonly campaignRanking = computed(() => this.charts()?.campaignRanking ?? []);

  /** Agentes en error o fuera de linea: el dato que explica la salud de la operacion. */
  protected readonly unavailableAgents = computed(() => {
    const byStatus = this.kpis()?.agents.byStatus;
    if (!byStatus) return 0;
    return (byStatus['error'] ?? 0) + (byStatus['offline'] ?? 0);
  });

  /** Serie corta para el sparkline del indicador de leads. */
  protected readonly leadsTrend = computed(() =>
    (this.charts()?.leadsSeries ?? []).map((point) => point.value),
  );

  // --- Utilidades de plantilla -------------------------------------------------

  protected readonly healthTone = computed(() => {
    const score = this.health()?.score ?? 0;
    if (score >= 85) return '#5ce08a';
    if (score >= 65) return '#ffc44d';
    return '#d03b3b';
  });

  protected severityColor(level: string): string {
    if (level === 'error') return '#d03b3b';
    if (level === 'warning') return '#ffc44d';
    if (level === 'success') return '#5ce08a';
    return '#5b9bff';
  }

  protected severityIcon(level: string): 'warning' | 'check' | 'grid' {
    if (level === 'error') return 'warning';
    if (level === 'success') return 'check';
    return 'grid';
  }

  protected readonly revenueTotal = computed(() => this.kpis()?.revenue.simulated ?? 0);
  protected readonly pipeline = computed(() => this.kpis()?.leads.pipelineValue ?? 0);

  protected labelEuro = (value: number) => formatEuro(value);
  protected labelNumber = (value: number) => formatNumber(value, 0);
  protected labelPercent = (value: number) => formatPercent(value);
}
