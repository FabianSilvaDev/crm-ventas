import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
} from '../../ui';
import {
  ProductOpportunityCardComponent,
  type ProductOpportunity,
} from './components/product-opportunity-card/product-opportunity-card';

/**
 * Products — catálogo e inteligencia de producto.
 *
 * Presenta el flujo mental del usuario: Descubrir → Analizar → Puntuar →
 * Seleccionar → Vender. Hoy la pantalla usa datos de demostración para las
 * oportunidades porque el backend de product intelligence aún no existe.
 *
 * ## FRONTEND DATA GAP
 *
 * No hay endpoints para:
 *   - product discovery / market research
 *   - scoring de productos
 *   - competidores
 *   - tendencias de mercado
 *   - catálogo de productos
 *
 * Las oportunidades mostradas son visuales de demostración. Cuando existan los
 * servicios de product intelligence se conectarán aquí sin reescribir la
 * estructura de la pantalla.
 */

interface PipelineStep {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

@Component({
  selector: 'app-products',
  imports: [
    CardComponent,
    BadgeComponent,
    ButtonComponent,
    IconComponent,
    EmptyStateComponent,
    ProductOpportunityCardComponent,
  ],
  templateUrl: './products.html',
  styleUrl: './products.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products {
  /** Flujo de inteligencia de producto. */
  protected readonly pipeline: readonly PipelineStep[] = [
    { id: 'discover', label: 'Descubrir', description: 'Encontrar productos con demanda comprobada.' },
    { id: 'analyze', label: 'Analizar', description: 'Estudiar competencia, margen y riesgos.' },
    { id: 'score', label: 'Puntuar', description: 'Calcular oportunidad con datos estructurados.' },
    { id: 'select', label: 'Seleccionar', description: 'Elegir los productos con mejor ratio riesgo/retorno.' },
    { id: 'sell', label: 'Vender', description: 'Lanzar campañas y contenido para convertir.' },
  ];

  /** Oportunidades de demostración. Se marcan como Demo en pantalla. */
  protected readonly opportunities: readonly ProductOpportunity[] = [
    {
      id: 'demo-rolex-submarino-azul',
      name: 'Reloj Rolex Submariner réplica azul',
      score: 91,
      demand: 'high',
      competition: 'medium',
      margin: 65,
      trend: 'up',
      trendValue: '↑ 41%',
      aiInsight: 'Alta intención de compra en búsquedas de réplicas de lujo; margen superior al 60%.',
      actions: [
        { id: 'analyze', label: 'Analizar', primary: true },
        { id: 'campaign', label: 'Crear campaña', primary: false },
        { id: 'content', label: 'Generar contenido', primary: false },
        { id: 'landing', label: 'Crear landing', primary: false },
        { id: 'ignore', label: 'Ignorar', primary: false },
      ],
    },
    {
      id: 'demo-1',
      name: 'Auriculares inalámbricos premium',
      score: 87,
      demand: 'high',
      competition: 'medium',
      margin: 32,
      trend: 'up',
      trendValue: '↑ 24%',
      aiInsight: 'La demanda crece mientras la competencia se mantiene moderada.',
      actions: [
        { id: 'analyze', label: 'Analizar', primary: true },
        { id: 'campaign', label: 'Crear campaña', primary: false },
        { id: 'content', label: 'Generar contenido', primary: false },
        { id: 'landing', label: 'Crear landing', primary: false },
        { id: 'ignore', label: 'Ignorar', primary: false },
      ],
    },
    {
      id: 'demo-2',
      name: 'Cargador solar portátil',
      score: 72,
      demand: 'medium',
      competition: 'low',
      margin: 28,
      trend: 'up',
      trendValue: '↑ 12%',
      aiInsight: 'Nicho emergente con poca competencia en el mercado local.',
      actions: [
        { id: 'analyze', label: 'Analizar', primary: true },
        { id: 'campaign', label: 'Crear campaña', primary: false },
        { id: 'ignore', label: 'Ignorar', primary: false },
      ],
    },
  ];

  /** Para simular que se puede marcar una oportunidad como ignorada. */
  protected readonly hiddenOpportunities = signal<ReadonlySet<string>>(new Set());

  protected readonly visibleOpportunities = computed(() =>
    this.opportunities.filter((o) => !this.hiddenOpportunities().has(o.id)),
  );

  protected handleAction(opportunityId: string, actionId: string): void {
    // En el MVP visual, "Ignorar" simplemente oculta la tarjeta de demostración.
    if (actionId === 'ignore') {
      this.hiddenOpportunities.update((set) => new Set([...set, opportunityId]));
      return;
    }

    // Las demás acciones aún no tienen backend; se documentan como gap.
    // eslint-disable-next-line no-console
    console.info(`[Products] Acción "${actionId}" sobre ${opportunityId} — FRONTEND DATA GAP`);
  }
}
