import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  isDevMode,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { SessionService, puertaDeDemostracionAbierta } from '../../../core/session';
import { IconComponent } from '../../../ui/icon/icon';

/**
 * Gestión de usuarios del workspace.
 *
 * Punto central para crear cuentas de AGENT dentro de la organización. El registro
 * es intra-organización, protegido por `MANAGE_AGENTS`, y solo permite el rol `AGENT`
 * (ADR-025). Un OWNER puede crear AGENTs; un AGENT no.
 *
 * ## Sin `@angular/forms`
 *
 * Tres campos (email, contraseña, repetir contraseña) y un botón. Se leen del formulario
 * en el momento del envío para no desincronizarse con el autocompletado del navegador.
 * La validación que importa es la del servidor; el cliente solo hace comprobaciones mínimas
 * que eviten envíos evidentemente inválidos.
 *
 * ## Sesión de demostración
 *
 * En modo demostración (`demoSession && isDevMode()`) no hay token real ni permisos. La
 * pantalla lo detecta y muestra un aviso en vez de intentar llamar al API. Esto permite
 * seguir navegando la UI durante el desarrollo sin backend.
 */

const MANAGE_AGENTS = 'MANAGE_AGENTS';

export type UsersOutcome = 'idle' | 'sending' | 'created' | 'forbidden' | 'error';

export interface UsersFailure {
  readonly title: string;
  readonly detail: string;
  readonly traceId: string | null;
  readonly code: string | null;
}

@Component({
  selector: 'app-users',
  templateUrl: './users.html',
  styleUrl: './users.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
})
export class Users {
  readonly #session = inject(SessionService);
  readonly #router = inject(Router);
  readonly #injector = inject(Injector);

  protected readonly outcome = signal<UsersOutcome>('idle');
  protected readonly failure = signal<UsersFailure | null>(null);
  protected readonly createdEmail = signal<string | null>(null);

  private readonly resumen = viewChild<ElementRef<HTMLElement>>('resumen');

  protected readonly isDemo = computed(() =>
    puertaDeDemostracionAbierta(environment.demoSession, isDevMode()),
  );

  /** Fall-closed en el cliente: sin MANAGE_AGENTS no mostramos el formulario. */
  protected readonly canManageUsers = computed(() =>
    this.#session.permissions().includes(MANAGE_AGENTS),
  );

  protected readonly hasError = computed(() => this.failure() !== null);

  /** El input puede aparecer solo cuando `canManageUsers()` es true, así que la referencia
   *  puede ser undefined hasta que se repinte. */
  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();

    if (this.outcome() === 'sending') {
      return;
    }

    const form = event.target as HTMLFormElement;
    const email = String(new FormData(form).get('email') ?? '').trim();
    const password = String(new FormData(form).get('password') ?? '');
    const passwordConfirm = String(new FormData(form).get('passwordConfirm') ?? '');

    this.failure.set(null);
    this.createdEmail.set(null);

    const clientError = this.#clientValidation(password, passwordConfirm);
    if (clientError !== null) {
      this.failure.set({
        title: 'Revisa el formulario',
        detail: clientError,
        traceId: null,
        code: null,
      });
      await this.#focusResumen();
      return;
    }

    this.outcome.set('sending');

    const result = await this.#session.register(email, password);

    this.outcome.set(result.outcome === 'ok' ? 'created' : 'error');

    if (result.outcome === 'ok' && result.body !== null) {
      this.createdEmail.set(result.body.email);
      form.reset();
      this.#focusEmail();
      return;
    }

    if (result.outcome === 'problem' && result.problem !== null) {
      if (result.problem.code === 'FORBIDDEN_PERMISSION') {
        this.outcome.set('forbidden');
      }

      this.failure.set({
        title: result.problem.title,
        detail: result.problem.detail,
        traceId: result.traceId,
        code: result.problem.code,
      });
    } else {
      this.failure.set({
        title: 'No se pudo contactar con el servidor',
        detail: result.transportError ?? 'No hubo respuesta del API.',
        traceId: result.traceId,
        code: null,
      });
    }

    await this.#focusResumen();
  }

  protected goBack(): void {
    void this.#router.navigateByUrl('/settings');
  }

  #clientValidation(password: string, passwordConfirm: string): string | null {
    if (password.length < 12) {
      return 'La contraseña debe tener al menos 12 caracteres.';
    }

    if (password.length > 128) {
      return 'La contraseña no puede superar los 128 caracteres.';
    }

    if (!/[A-Z]/.test(password)) {
      return 'La contraseña debe incluir al menos una mayúscula.';
    }

    if (!/[a-z]/.test(password)) {
      return 'La contraseña debe incluir al menos una minúscula.';
    }

    if (!/\d/.test(password)) {
      return 'La contraseña debe incluir al menos un número.';
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'La contraseña debe incluir al menos un símbolo.';
    }

    if (password !== passwordConfirm) {
      return 'Las dos contraseñas no coinciden.';
    }

    return null;
  }

  async #focusResumen(): Promise<void> {
    return new Promise<void>((resolve) => {
      afterNextRender(() => {
        this.resumen()?.nativeElement.focus();
        resolve();
      }, { injector: this.#injector });
    });
  }

  #focusEmail(): void {
    this.emailInput()?.nativeElement.focus();
  }
}
