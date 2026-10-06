import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { SessionService } from '../../core/session';
import type { AuthResult, SetupBody } from '../../core/auth-api';

/**
 * Setup inicial (`/setup`).
 *
 * Crea el primer OWNER cuando la base de datos está vacía. Solo es accesible si el backend responde
 * `GET /auth/setup` con `{ required: true }`; si no, el guard del login ya habría redirigido a
 * `/entrar`.
 *
 * ## Sin `@angular/forms`
 *
 * Reutiliza el mismo patrón que login y users: leer `FormData` en el submit, validar contraseña
 * con la política del contrato y delegar en `SessionService.setup`.
 */

export type SetupOutcome = 'idle' | 'sending' | 'created' | 'error';

export interface SetupFailure {
  readonly title: string;
  readonly detail: string;
  readonly traceId: string | null;
  readonly code: string | null;
}

@Component({
  selector: 'app-setup',
  templateUrl: './setup.html',
  styleUrl: './setup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Setup {
  readonly #session = inject(SessionService);
  readonly #router = inject(Router);
  readonly #injector = inject(Injector);

  protected readonly outcome = signal<SetupOutcome>('idle');
  protected readonly failure = signal<SetupFailure | null>(null);

  private readonly resumen = viewChild<ElementRef<HTMLElement>>('resumen');

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();

    if (this.outcome() === 'sending') {
      return;
    }

    const form = event.target as HTMLFormElement;
    const datos = new FormData(form);
    const email = String(datos.get('email') ?? '').trim();
    const organizationName = String(datos.get('organizationName') ?? '').trim();
    const password = String(datos.get('password') ?? '');
    const passwordConfirm = String(datos.get('passwordConfirm') ?? '');

    this.failure.set(null);

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

    const resultado = await this.#session.setup(
      email,
      password,
      organizationName || undefined,
    );

    this.outcome.set(resultado.outcome === 'ok' ? 'created' : 'error');

    if (resultado.outcome === 'ok' && resultado.body !== null) {
      await this.#router.navigateByUrl('/home');
      return;
    }

    this.failure.set(this.#comoFallo(resultado));
    await this.#focusResumen();
  }

  protected goToLogin(): void {
    void this.#router.navigateByUrl('/entrar');
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

  #comoFallo(resultado: AuthResult<SetupBody>): SetupFailure {
    if (resultado.outcome === 'problem' && resultado.problem !== null) {
      return {
        title: resultado.problem.title,
        detail: resultado.problem.detail,
        traceId: resultado.traceId,
        code: resultado.problem.code,
      };
    }

    return {
      title: 'No se pudo contactar con el servidor',
      detail: resultado.transportError ?? 'No hubo respuesta del API.',
      traceId: resultado.traceId,
      code: null,
    };
  }

  async #focusResumen(): Promise<void> {
    return new Promise<void>((resolve) => {
      afterNextRender(() => {
        this.resumen()?.nativeElement.focus();
        resolve();
      }, { injector: this.#injector });
    });
  }
}
