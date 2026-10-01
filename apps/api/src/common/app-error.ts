import type { ErrorCode, ValidationIssue } from '@crm/contracts';

export interface AppErrorOptions {
  /** Dato estructurado para el cliente. **Nunca** PII ni secretos (`docs/api.md` §2.1). */
  readonly context?: unknown;
  /** Issues de validación, para `VALIDATION_FAILED`. */
  readonly errors?: readonly ValidationIssue[];
  /** Error original, para el log. No se serializa al cliente. */
  readonly cause?: unknown;
}

/**
 * Error de dominio: la única forma de producir una respuesta de error tipada desde el código de
 * negocio.
 *
 * Lleva un `code` del catálogo de `docs/api.md` §2.3 y **nada más**: el `status`, el `retryable`
 * y el `type` los resuelve el filtro desde ese catálogo. Así es imposible que un `throw` escriba
 * a mano un 500 donde el contrato dice 422.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly detail: string;
  readonly context?: unknown;
  readonly errors?: readonly ValidationIssue[];

  constructor(code: ErrorCode, detail: string, options: AppErrorOptions = {}) {
    super(detail);

    this.name = 'AppError';
    this.code = code;
    this.detail = detail;

    if (options.context !== undefined) {
      this.context = options.context;
    }
    if (options.errors !== undefined) {
      this.errors = options.errors;
    }
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
