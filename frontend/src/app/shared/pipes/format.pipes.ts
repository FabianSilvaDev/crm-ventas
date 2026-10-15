/**
 * Tuberias de presentacion.
 *
 * Se declaran juntas porque todas envuelven las funciones de `shared/format`, que
 * es la unica fuente de verdad del formato en espanol.
 *
 * Nota: se evitan los nombres de las tuberias integradas de Angular (`date`,
 * `number`, `percent`, `currency`) porque aqui el formato siempre es espanol y con
 * reglas propias (por ejemplo, la marca de dato ausente).
 */
import { Pipe, type PipeTransform } from '@angular/core';
import type { AgentStatus } from '../../core/models/agents.model';
import { AGENT_STATUS_LABEL, labelOf } from '../../core/models/labels';
import {
  formatCompact,
  formatDate,
  formatDateTime,
  formatDuration,
  formatEuro,
  formatMinutes,
  formatNumber,
  formatPercent,
  formatTimeAgo,
} from '../format/format';

@Pipe({ name: 'num' })
export class NumberEsPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = 0): string {
    return formatNumber(value, Number(decimals));
  }
}

@Pipe({ name: 'eur' })
export class EuroPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = 0): string {
    return formatEuro(value, Number(decimals));
  }
}

@Pipe({ name: 'rate' })
export class PercentPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = 1): string {
    return formatPercent(value, Number(decimals));
  }
}

@Pipe({ name: 'compact' })
export class CompactNumberPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatCompact(value);
  }
}

@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatDuration(value);
  }
}

@Pipe({ name: 'minutes' })
export class MinutesPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatMinutes(value);
  }
}

/**
 * Tiempo relativo. El segundo argumento permite fijar la referencia: los datos de
 * la demo son historicos, asi que se comparan contra `meta.demoReferenceDate`.
 */
@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | null | undefined, reference?: string | null): string {
    return formatTimeAgo(value, reference ?? undefined);
  }
}

@Pipe({ name: 'dateEs' })
export class DateEsPipe implements PipeTransform {
  transform(value: string | null | undefined, mode: 'date' | 'datetime' = 'date'): string {
    return mode === 'datetime' ? formatDateTime(value) : formatDate(value);
  }
}

@Pipe({ name: 'agentStatus' })
export class AgentStatusPipe implements PipeTransform {
  transform(status: AgentStatus | string | null | undefined): string {
    return labelOf(AGENT_STATUS_LABEL, status ?? undefined);
  }
}

/** Coleccion de tuberias de presentacion, para importar de una sola vez. */
export const FORMAT_PIPES = [
  NumberEsPipe,
  EuroPipe,
  PercentPipe,
  CompactNumberPipe,
  DurationPipe,
  MinutesPipe,
  TimeAgoPipe,
  DateEsPipe,
  AgentStatusPipe,
] as const;
