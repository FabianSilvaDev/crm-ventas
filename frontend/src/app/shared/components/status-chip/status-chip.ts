/**
 * Etiqueta de estado.
 *
 * Los estados se comunican SIEMPRE con un glifo, un texto y un color: el color
 * nunca es el unico canal (requisito de accesibilidad del sistema de diseno).
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AgentStatus } from '../../../core/models/agents.model';
import {
  AGENT_STATUS_LABEL,
  AGENT_STATUS_TONE,
  CAMPAIGN_STATUS_LABEL,
  CONTENT_STATUS_LABEL,
  CREATIVE_STATUS_LABEL,
  LANDING_STATUS_LABEL,
  LEAD_STATUS_LABEL,
  LEAD_STATUS_TONE,
  OPPORTUNITY_STATUS_LABEL,
  OPPORTUNITY_STATUS_TONE,
  OFFER_STATUS_LABEL,
  PRODUCT_STATUS_LABEL,
  RUN_STATUS_LABEL,
  SEVERITY_LABEL,
  SEVERITY_TONE,
  STAGE_STATUS_LABEL,
  TASK_STATUS_LABEL,
  labelOf,
} from '../../../core/models/labels';
import { STATUS_COLOR, statusGlyph } from '../../pixel/agent-sprites';
import { toDataUri } from '../../pixel/pixel-art';

/** Familias de estado que sabe traducir la etiqueta. */
export type StatusKind =
  | 'agent'
  | 'lead'
  | 'product'
  | 'offer'
  | 'campaign'
  | 'content'
  | 'creative'
  | 'landing'
  | 'stage'
  | 'run'
  | 'task'
  | 'opportunity'
  | 'severity';

const LABEL_MAPS: Record<StatusKind, Record<string, string>> = {
  agent: AGENT_STATUS_LABEL,
  lead: LEAD_STATUS_LABEL,
  product: PRODUCT_STATUS_LABEL,
  offer: OFFER_STATUS_LABEL,
  campaign: CAMPAIGN_STATUS_LABEL,
  content: CONTENT_STATUS_LABEL,
  creative: CREATIVE_STATUS_LABEL,
  landing: LANDING_STATUS_LABEL,
  stage: STAGE_STATUS_LABEL,
  run: RUN_STATUS_LABEL,
  task: TASK_STATUS_LABEL,
  opportunity: OPPORTUNITY_STATUS_LABEL,
  severity: SEVERITY_LABEL,
};

const TONE_MAPS: Partial<Record<StatusKind, Record<string, string>>> = {
  agent: AGENT_STATUS_TONE,
  lead: LEAD_STATUS_TONE,
  opportunity: OPPORTUNITY_STATUS_TONE,
  severity: SEVERITY_TONE,
};

/** Tonos por defecto de las familias que no declaran un mapa propio. */
const DEFAULT_TONES: Record<string, string> = {
  active: 'chip--good',
  live: 'chip--good',
  published: 'chip--good',
  ready: 'chip--good',
  validated: 'chip--good',
  won: 'chip--good',
  completed: 'chip--good',
  approved: 'chip--good',
  draft: 'chip--neutral',
  idea: 'chip--neutral',
  discarded: 'chip--neutral',
  lost: 'chip--neutral',
  pending: 'chip--neutral',
  skipped: 'chip--neutral',
  paused: 'chip--warning',
  review: 'chip--warning',
  validating: 'chip--warning',
  researching: 'chip--info',
  scheduled: 'chip--info',
  running: 'chip--info',
  proposal: 'chip--warning',
  failed: 'chip--critical',
  error: 'chip--critical',
  // Puertas de decision: esperar al operador es un aviso; una parada decidida, un final.
  blocked: 'chip--warning',
  awaiting_approval: 'chip--warning',
  rejected: 'chip--critical',
};

/** Color del glifo por familia. */
const GLYPH_COLORS: Partial<Record<StatusKind, string>> = {
  agent: '',
};

@Component({
  selector: 'app-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="chip" [class]="tone()">
      <img class="chip__glyph" [src]="glyph()" alt="" aria-hidden="true" />
      {{ text() }}
    </span>
  `,
  styles: [
    `
      .chip__glyph {
        width: 8px;
        height: 8px;
        image-rendering: pixelated;
      }
    `,
  ],
})
export class StatusChip {
  readonly status = input.required<string>();
  readonly kind = input<StatusKind>('agent');
  /** Sustituye el texto traducido cuando la vista necesita otro literal. */
  readonly textOverride = input('');

  readonly text = computed(() => this.textOverride() || labelOf(LABEL_MAPS[this.kind()], this.status()));

  readonly tone = computed(() => {
    const toneMap = TONE_MAPS[this.kind()];
    return toneMap?.[this.status()] ?? DEFAULT_TONES[this.status()] ?? 'chip--neutral';
  });

  /** Glifo: para agentes usa su glifo propio; el resto comparte formas genericas. */
  readonly glyph = computed(() => {
    if (this.kind() === 'agent') {
      return toDataUri(statusGlyph(this.status() as AgentStatus), { accent: STATUS_COLOR[this.status() as AgentStatus] });
    }

    const color = GLYPH_COLORS[this.kind()] || glyphColorFor(this.tone());
    return toDataUri(statusGlyph(glyphShapeFor(this.status())), { accent: color });
  });
}

/** Forma del glifo segun el estado, reutilizando los globos de la oficina. */
const glyphShapeFor = (status: string): AgentStatus => {
  switch (status) {
    case 'active':
    case 'live':
    case 'published':
    case 'ready':
    case 'validated':
    case 'won':
    case 'completed':
    case 'approved':
      return 'completed';
    case 'running':
    case 'scheduled':
      return 'working';
    case 'paused':
    case 'proposal':
    case 'review':
    case 'validating':
    case 'candidate':
    case 'blocked':
    case 'awaiting_approval':
      return 'thinking';
    case 'failed':
    case 'error':
    case 'rejected':
      return 'error';
    case 'draft':
    case 'idea':
    case 'pending':
    case 'skipped':
    case 'lost':
    case 'discarded':
      return 'idle';
    default:
      return 'idle';
  }
};

/** Color del glifo derivado del tono del chip. */
const glyphColorFor = (tone: string): string => {
  if (tone.includes('good')) return '#5ce08a';
  if (tone.includes('warning')) return '#ffc44d';
  if (tone.includes('critical')) return '#d03b3b';
  if (tone.includes('info')) return '#5b9bff';
  return '#8fa7b8';
};
