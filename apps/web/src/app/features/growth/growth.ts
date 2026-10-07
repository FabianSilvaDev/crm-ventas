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
  CampaignCardComponent,
  type Campaign,
} from './components/campaign-card/campaign-card';
import {
  CreativeCardComponent,
  type Creative,
} from './components/creative-card/creative-card';
import {
  AudienceListComponent,
  type Audience,
} from './components/audience-list/audience-list';
import {
  ExperimentListComponent,
  type Experiment,
} from './components/experiment-list/experiment-list';

/**
 * Growth — ecosistema de crecimiento.
 *
 * Punto central para campañas, creativos, audiencias, experimentos y
 * oportunidades de SEO/contenido. Hoy funciona con datos de demostración
 * etiquetados; cuando existan conectores con Meta, Google Ads, TikTok y el
 * motor de contenido de IA, se conectarán sin cambiar la estructura visual.
 *
 * ## FRONTEND DATA GAP
 *
 * El backend no expone aún:
 *   - campañas publicitarias activas (presupuesto, gasto, ROAS, CTR);
 *   - creativos y su rendimiento;
 *   - audiencias y tasas de conversión por segmento;
 *   - experimentos A/B y sus resultados;
 *   - oportunidades de SEO/keywords y calendario de contenido.
 *
 * Por eso esta pantalla muestra datos de demostración con badge `Demo` y deja
 * estados vacíos accionables para SEO/contenido. Las acciones de gestionar
 * campañas se registran como `FRONTEND DATA GAP` hasta que haya endpoints reales.
 */

interface GrowthStep {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

@Component({
  selector: 'app-growth',
  imports: [
    CardComponent,
    MetricComponent,
    ButtonComponent,
    BadgeComponent,
    IconComponent,
    EmptyStateComponent,
    CampaignCardComponent,
    CreativeCardComponent,
    AudienceListComponent,
    ExperimentListComponent,
  ],
  templateUrl: './growth.html',
  styleUrl: './growth.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Growth {
  protected readonly pipeline: readonly GrowthStep[] = [
    {
      id: 'attract',
      label: 'Atraer',
      description: 'Campañas y contenido que traen visitantes.',
    },
    {
      id: 'engage',
      label: 'Enganchar',
      description: 'Creativos y audiencias que generan interés.',
    },
    {
      id: 'convert',
      label: 'Convertir',
      description: 'Experimentos que mejoran la tasa de conversión.',
    },
    {
      id: 'retain',
      label: 'Retener',
      description: 'Seguimiento y nutrición de clientes.',
    },
    {
      id: 'optimize',
      label: 'Optimizar',
      description: 'Aprender de datos y escalar lo que funciona.',
    },
  ];

  protected readonly campaigns: readonly Campaign[] = [
    {
      id: 'c-submarino-azul',
      name: 'Submarino Azul — Lujo accesible',
      status: 'active',
      channel: 'Meta Ads',
      budget: 2500,
      spend: 980,
      leads: 67,
      ctr: 0.047,
      roas: 3.6,
      daysLeft: 21,
    },
    {
      id: 'c-verano',
      name: 'Verano 2025',
      status: 'active',
      channel: 'Meta Ads',
      budget: 5000,
      spend: 2100,
      leads: 124,
      ctr: 0.034,
      roas: 2.4,
      daysLeft: 18,
    },
    {
      id: 'c-lookalike',
      name: 'Lookalike Compradores',
      status: 'active',
      channel: 'Meta Ads',
      budget: 3000,
      spend: 1450,
      leads: 89,
      ctr: 0.041,
      roas: 3.1,
      daysLeft: 12,
    },
    {
      id: 'c-retarget',
      name: 'Retargeting Web',
      status: 'paused',
      channel: 'Google Ads',
      budget: 1500,
      spend: 980,
      leads: 34,
      ctr: 0.027,
      roas: 1.8,
      daysLeft: 5,
    },
  ];

  protected readonly creatives: readonly Creative[] = [
    {
      id: 'cr-submarino-hero',
      name: 'Submarino Azul — Close-up esfera',
      format: 'video',
      campaignName: 'Submarino Azul — Lujo accesible',
      impressions: 32_100,
      ctr: 0.052,
    },
    {
      id: 'cr-submarino-carousel',
      name: 'Submarino Azul — Detalles 3 slides',
      format: 'carousel',
      campaignName: 'Submarino Azul — Lujo accesible',
      impressions: 18_400,
      ctr: 0.039,
    },
    {
      id: 'cr-hero',
      name: 'Hero Verano',
      format: 'video',
      campaignName: 'Verano 2025',
      impressions: 45_230,
      ctr: 0.041,
    },
    {
      id: 'cr-carousel',
      name: 'Beneficios 3 slides',
      format: 'carousel',
      campaignName: 'Verano 2025',
      impressions: 28_700,
      ctr: 0.029,
    },
    {
      id: 'cr-testimonial',
      name: 'Testimonial cliente',
      format: 'image',
      campaignName: 'Lookalike Compradores',
      impressions: 19_400,
      ctr: 0.035,
    },
  ];

  protected readonly audiences: readonly Audience[] = [
    {
      id: 'a-lujo-nicho',
      name: 'Interés Réplicas de Lujo',
      size: 156_000,
      conversionRate: 0.034,
      channel: 'Meta Ads',
    },
    {
      id: 'a-lookalike',
      name: 'Lookalike Compradores',
      size: 245_000,
      conversionRate: 0.028,
      channel: 'Meta Ads',
    },
    {
      id: 'a-interest',
      name: 'Interés Tech',
      size: 89_000,
      conversionRate: 0.019,
      channel: 'TikTok',
    },
    {
      id: 'a-retarget',
      name: 'Visitantes 30 días',
      size: 12_400,
      conversionRate: 0.046,
      channel: 'Google Ads',
    },
  ];

  protected readonly experiments: readonly Experiment[] = [
    {
      id: 'e-cta',
      name: 'CTA primario',
      hypothesis: 'Un botón de acción más directo aumenta la tasa de click.',
      status: 'winner',
      variantA: 'Saber más',
      variantB: 'Comprar ahora',
      winner: 'B',
      lift: 0.18,
    },
    {
      id: 'e-hero',
      name: 'Imagen hero',
      hypothesis: 'Vídeo corto vs imagen estática en la landing.',
      status: 'running',
      variantA: 'Imagen estática',
      variantB: 'Vídeo 6s',
      winner: null,
      lift: 0,
    },
  ];

  protected onNewCampaign(): void {
    // FRONTEND DATA GAP: no hay backend para crear campañas aún.
    // Se mantiene el botón visible para mantener la acción mental del usuario.
    console.log('FRONTEND DATA GAP: no backend endpoint to create a campaign');
  }

  protected onCampaignAction(campaign: Campaign): void {
    console.log(
      'FRONTEND DATA GAP: no backend endpoint to manage campaign',
      campaign.id,
    );
  }
}
