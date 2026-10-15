/**
 * Retrato de un agente: compone el sprite procedural (cuerpo + peinado +
 * accesorio) y lo tinta con el acento de su departamento.
 *
 * El nombre del agente acompana siempre al retrato, de modo que la identidad nunca
 * depende solo del color.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AgentAvatar, AgentStatus } from '../../../core/models/agents.model';
import { STATUS_COLOR, buildAgentSprite } from '../../pixel/agent-sprites';
import { toDataUri } from '../../pixel/pixel-art';

@Component({
  selector: 'app-agent-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="avatar" [style.width.px]="size()" [style.height.px]="size()">
      <img
        class="avatar__sprite"
        [src]="uri()"
        [attr.alt]="label()"
        [style.filter]="dimmed() ? 'saturate(0.35) brightness(0.75)' : null"
      />
      @if (showStatus()) {
        <span class="avatar__status" [style.background]="statusColor()" [title]="status()"></span>
      }
    </div>
  `,
  styles: [
    `
      .avatar {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #070a0e;
        border: 2px solid var(--px-line);
        flex: 0 0 auto;
      }

      .avatar__sprite {
        width: 100%;
        height: 100%;
        image-rendering: pixelated;
        padding: 2px;
      }

      .avatar__status {
        position: absolute;
        right: -3px;
        bottom: -3px;
        width: 8px;
        height: 8px;
        border: 2px solid #070a0e;
      }
    `,
  ],
})
export class AgentAvatarView {
  readonly avatar = input.required<AgentAvatar>();
  readonly size = input(48);
  readonly status = input<AgentStatus>('idle');
  readonly label = input('');
  readonly showStatus = input(true);

  readonly uri = computed(() => toDataUri(buildAgentSprite(this.avatar()), {}, { title: this.label() || undefined }));
  readonly statusColor = computed(() => STATUS_COLOR[this.status()] ?? STATUS_COLOR.idle);
  readonly dimmed = computed(() => this.status() === 'offline');
}
