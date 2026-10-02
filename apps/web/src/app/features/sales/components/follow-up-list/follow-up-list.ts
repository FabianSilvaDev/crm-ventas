import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';

import { CardComponent } from '../../../../ui';
import { IconComponent, type IconName } from '../../../../ui/icon/icon';

export type FollowUpType = 'call' | 'email' | 'meeting' | 'task';

export interface FollowUp {
  readonly id: string;
  readonly leadName: string;
  readonly type: FollowUpType;
  readonly subject: string;
  readonly dueAt: string;
  readonly overdue: boolean;
}

/**
 * Lista compacta de seguimientos pendientes.
 *
 * Datos de demostración hasta que exista un backend de tareas de ventas.
 */
@Component({
  selector: 'app-follow-up-list',
  imports: [CardComponent, IconComponent, DatePipe],
  templateUrl: './follow-up-list.html',
  styleUrl: './follow-up-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowUpListComponent {
  readonly followUps = input.required<readonly FollowUp[]>();

  protected iconFor(type: FollowUpType): IconName {
    const map: Record<FollowUpType, IconName> = {
      call: 'phone',
      email: 'mail',
      meeting: 'calendar',
      task: 'checkCircle',
    };
    return map[type];
  }

  protected labelFor(type: FollowUpType): string {
    const map: Record<FollowUpType, string> = {
      call: 'Llamada',
      email: 'Email',
      meeting: 'Reunión',
      task: 'Tarea',
    };
    return map[type];
  }
}
