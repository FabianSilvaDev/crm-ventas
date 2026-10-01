import { z } from 'zod';

/**
 * Catálogo de errores del dominio.
 *
 * Fuente: `docs/api.md` §2.3. **Los 43 códigos se copian de ese documento, no se inventan.**
 * Si hace falta uno nuevo, primero se añade a la tabla de `api.md` y después aquí.
 *
 * `title`, `type` y `docs` NO se declaran a mano: `type` y `docs` se derivan del código en
 * kebab-case, y `title` vive aquí porque es el único texto que no es derivable. Derivar evita la
 * clase de error que ya hemos tenido tres veces en este proyecto: dos sitios afirmando lo mismo y
 * divergiendo en silencio.
 */

/** Base de las URIs de `type` (RFC 9457). Ver `docs/api.md` §2.1 y §2.2. */
export const PROBLEM_TYPE_BASE = 'https://errors.crm-ventas.internal/problems';

/** Base de las URIs de `docs`. */
export const PROBLEM_DOCS_BASE = 'https://docs.crm-ventas.internal/api/errors';

export interface ErrorSpec {
  /** Código HTTP. Va repetido en el cuerpo (`status`), como exige RFC 9457. */
  readonly status: number;
  /** `true` si reintentar la **misma** request puede tener éxito. */
  readonly retryable: boolean;
  /** Resumen humano corto en español. Estable: no cambia entre instancias. */
  readonly title: string;
}

/**
 * Catálogo completo. El orden reproduce el de la tabla de `api.md` §2.3 para que comparar
 * documento y código sea mecánico.
 */
export const ERROR_CATALOG = {
  // ── Autenticación y sesión ────────────────────────────────────────────────
  AUTH_INVALID_CREDENTIALS: { status: 401, retryable: false, title: 'Credenciales inválidas' },
  AUTH_TOKEN_EXPIRED: { status: 401, retryable: true, title: 'Token de acceso expirado' },
  AUTH_TOKEN_INVALID: { status: 401, retryable: false, title: 'Token de acceso inválido' },
  AUTH_ACCOUNT_LOCKED: { status: 423, retryable: true, title: 'Cuenta bloqueada temporalmente' },
  REFRESH_TOKEN_INVALID: { status: 401, retryable: false, title: 'Token de refresco inválido' },
  REFRESH_TOKEN_REUSE_DETECTED: {
    status: 401,
    retryable: false,
    title: 'Reuso de token de refresco detectado',
  },

  // ── Autorización y recursos ───────────────────────────────────────────────
  FORBIDDEN_PERMISSION: { status: 403, retryable: false, title: 'Permiso insuficiente' },
  RESOURCE_NOT_FOUND: { status: 404, retryable: false, title: 'Recurso no encontrado' },

  // ── Validación y concurrencia ─────────────────────────────────────────────
  VALIDATION_FAILED: { status: 422, retryable: false, title: 'Validación fallida' },
  PRECONDITION_REQUIRED: { status: 428, retryable: false, title: 'Falta la precondición If-Match' },
  PRECONDITION_FAILED: { status: 412, retryable: true, title: 'La precondición no se cumple' },
  STATE_CONFLICT: { status: 409, retryable: false, title: 'Conflicto de estado' },

  // ── Campañas y aprobaciones ───────────────────────────────────────────────
  CAMPAIGN_INVALID_TRANSITION: {
    status: 409,
    retryable: false,
    title: 'Transición de campaña no permitida',
  },
  APPROVAL_REQUIRED: { status: 428, retryable: false, title: 'Se requiere aprobación' },
  APPROVAL_PAYLOAD_CHANGED: {
    status: 409,
    retryable: false,
    title: 'El contenido cambió respecto al aprobado',
  },
  APPROVAL_EXPIRED: { status: 410, retryable: false, title: 'La aprobación expiró' },

  // ── Presupuesto (guardrails §P.3) ─────────────────────────────────────────
  BUDGET_GUARDRAIL_EXCEEDED: {
    status: 422,
    retryable: false,
    title: 'Se supera un límite de presupuesto',
  },
  BUDGET_CHANGE_REQUIRES_APPROVAL: {
    status: 428,
    retryable: false,
    title: 'El cambio de presupuesto requiere aprobación',
  },

  // ── Conectores (ADR-004) ──────────────────────────────────────────────────
  CONNECTOR_NOT_APPROVED: { status: 403, retryable: false, title: 'Conector sin aprobación legal' },
  CONNECTOR_DISABLED: { status: 409, retryable: false, title: 'Conector deshabilitado' },
  CONNECTOR_RATE_LIMITED: { status: 429, retryable: true, title: 'Rate limit del marketplace' },
  CONNECTOR_QUOTA_EXCEEDED: { status: 429, retryable: true, title: 'Cuota diaria del conector agotada' },

  // ── Procedencia y economía (ADR-013) ──────────────────────────────────────
  INSUFFICIENT_DATA: {
    status: 422,
    retryable: false,
    title: 'Datos insuficientes para una conclusión',
  },
  PROVENANCE_MISSING: {
    status: 422,
    retryable: false,
    title: 'Falta la procedencia de un dato',
  },
  ECONOMICS_GATE_FAILED: {
    status: 422,
    retryable: false,
    title: 'No supera la puerta de economía unitaria',
  },

  // ── Idempotencia ──────────────────────────────────────────────────────────
  IDEMPOTENCY_CONFLICT: {
    status: 409,
    retryable: false,
    title: 'Misma clave de idempotencia con contenido distinto',
  },
  IDEMPOTENCY_IN_PROGRESS: {
    status: 409,
    retryable: true,
    title: 'La petición original sigue en curso',
  },

  // ── Tools de agentes (ADR-005) ────────────────────────────────────────────
  TOOL_DENIED: { status: 403, retryable: false, title: 'El agente no tiene el permiso de la tool' },
  TOOL_INVALID: { status: 422, retryable: false, title: 'Entrada de la tool inválida' },
  TOOL_THROTTLED: { status: 429, retryable: true, title: 'Rate limit de la tool excedido' },
  TOOL_BLOCKED: { status: 403, retryable: false, title: 'Tool bloqueada por política de red' },
  TOOL_BAD_OUTPUT: { status: 502, retryable: true, title: 'Salida de la tool inválida' },
  TOOL_TIMEOUT: { status: 504, retryable: true, title: 'La tool excedió su tiempo límite' },

  // ── Agentes y costo de IA ─────────────────────────────────────────────────
  AGENT_DISABLED: { status: 409, retryable: false, title: 'Agente deshabilitado' },
  AI_BUDGET_EXCEEDED: { status: 429, retryable: true, title: 'Presupuesto de IA agotado' },

  // ── Webhooks ──────────────────────────────────────────────────────────────
  WEBHOOK_SIGNATURE_INVALID: { status: 401, retryable: false, title: 'Firma del webhook inválida' },

  // ── Contenido y SEO ───────────────────────────────────────────────────────
  CONTENT_CANNIBALIZATION: {
    status: 409,
    retryable: false,
    title: 'Canibalización de palabra clave',
  },
  CONTENT_SANITIZATION_REJECTED: {
    status: 422,
    retryable: false,
    title: 'El HTML no supera la allowlist de sanitización',
  },
  SLUG_TAKEN: { status: 409, retryable: false, title: 'El slug ya está en uso' },

  // ── Identidad (ADR-014) ───────────────────────────────────────────────────
  IDENTITY_CONFLICT: { status: 409, retryable: false, title: 'Conflicto al fusionar identidades' },

  // ── Infraestructura ───────────────────────────────────────────────────────
  RATE_LIMIT_EXCEEDED: { status: 429, retryable: true, title: 'Límite de peticiones excedido' },
  DEPENDENCY_UNAVAILABLE: {
    status: 503,
    retryable: true,
    title: 'Dependencia no disponible',
  },
  INTERNAL_ERROR: { status: 500, retryable: true, title: 'Error interno' },
} as const satisfies Record<string, ErrorSpec>;

/** Unión de los códigos válidos. Es la clave estable del contrato, no `title`. */
export type ErrorCode = keyof typeof ERROR_CATALOG;

export const ERROR_CODES = Object.keys(ERROR_CATALOG) as readonly ErrorCode[];

/** `VALIDATION_FAILED` → `validation-failed`. */
export function toKebabCase(code: string): string {
  return code.toLowerCase().replace(/_/g, '-');
}

export function problemTypeFor(code: ErrorCode): string {
  return `${PROBLEM_TYPE_BASE}/${toKebabCase(code)}`;
}

export function problemDocsFor(code: ErrorCode): string {
  return `${PROBLEM_DOCS_BASE}/${toKebabCase(code)}`;
}

export function specFor(code: ErrorCode): ErrorSpec {
  return ERROR_CATALOG[code];
}

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const errorCodeSchema = z.enum(
  ERROR_CODES as unknown as [ErrorCode, ...ErrorCode[]],
);

/**
 * Issue de validación, derivado de `ZodError.issues` (`docs/api.md` §2.2).
 * `path` va en camelCase; `received` es opcional y **se omite** para campos sensibles.
 */
export const validationIssueSchema = z.object({
  path: z.string(),
  code: z.string(),
  message: z.string(),
  received: z.unknown().optional(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

/**
 * Cuerpo problem+json (RFC 9457) con extensión de dominio (`docs/api.md` §2.1).
 *
 * `context` se tipa como `unknown` a propósito: es dato estructurado arbitrario cuya forma
 * depende del código, y el contrato solo garantiza que **no** lleva PII ni secretos.
 */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string(),
  code: errorCodeSchema,
  traceId: z.string(),
  timestamp: z.string(),
  retryable: z.boolean(),
  docs: z.string().optional(),
  context: z.unknown().optional(),
  errors: z.array(validationIssueSchema).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Construcción
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildProblemInput {
  code: ErrorCode;
  detail: string;
  instance: string;
  traceId: string;
  /** Sobrescribe el `title` del catálogo solo si es imprescindible. Normalmente no. */
  title?: string;
  context?: unknown;
  errors?: readonly ValidationIssue[];
  /** Por defecto se toma del catálogo. Sobrescribir solo en casos documentados. */
  status?: number;
  timestamp?: string;
}

/**
 * Construye un `ProblemDetails` completo a partir del catálogo.
 *
 * Es la única vía de construcción en el API: así el `status`, `retryable`, `type` y `docs` de
 * cada respuesta salen **siempre** de §2.3 y no de la memoria de quien escribe el `throw`.
 */
export function buildProblem(input: BuildProblemInput): ProblemDetails {
  const spec = ERROR_CATALOG[input.code];

  const problem: ProblemDetails = {
    type: problemTypeFor(input.code),
    title: input.title ?? spec.title,
    status: input.status ?? spec.status,
    detail: input.detail,
    instance: input.instance,
    code: input.code,
    traceId: input.traceId,
    timestamp: input.timestamp ?? new Date().toISOString(),
    retryable: spec.retryable,
    docs: problemDocsFor(input.code),
  };

  if (input.context !== undefined) problem.context = input.context;
  if (input.errors !== undefined && input.errors.length > 0) {
    problem.errors = [...input.errors];
  }

  return problem;
}

// ─────────────────────────────────────────────────────────────────────────────
// Redacción de PII en errores de validación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Campos cuyo valor recibido **nunca** se refleja en la respuesta.
 *
 * Regla dura de `docs/api.md` §2.2: si el campo es secreto o personal, `received` se omite y el
 * `message` describe el formato esperado. Se compara por el último segmento del `path`, así que
 * `identity.email` y `email` caen ambos.
 */
const SENSITIVE_FIELD_NAMES: ReadonlySet<string> = new Set([
  'password',
  'passwordconfirm',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
  'email',
  'phone',
  'telefono',
  'phonenumber',
]);

export function isSensitiveField(path: string): boolean {
  const segments = path.split('.');
  const last = (segments[segments.length - 1] ?? '').toLowerCase();
  return SENSITIVE_FIELD_NAMES.has(last);
}

/** Forma mínima de un issue de Zod, sin acoplarse a una versión concreta de Zod. */
export interface ZodLikeIssue {
  readonly path: ReadonlyArray<string | number | symbol>;
  readonly code: string;
  readonly message: string;
  /** **Zod 4** nombra así el valor recibido. */
  readonly input?: unknown;
  /** Zod 3 lo llamaba `received`. Se admite por si algún issue se construye a mano. */
  readonly received?: unknown;
}

/**
 * Convierte issues de Zod en el array `errors` de §2.2, aplicando la redacción de PII.
 *
 * No importa `ZodError` para no acoplarse a la versión: cualquier objeto con `issues` sirve.
 *
 * HECHO COMPROBADO contra Zod 4.6: sus issues **no incluyen el valor recibido**. Traen `path`,
 * `code` y `message`, y para `invalid_type` un `expected`, pero ni `input` ni `received`. Por eso
 * `received` sale vacío en la práctica, y eso es lo más seguro: la alternativa sería
 * reconstruirlo leyendo `req.body` según el `path`, lo que convierte una heurística por nombre de
 * campo en una vía de fuga de credenciales.
 *
 * La redacción se mantiene porque sigue siendo una garantía para issues construidos a mano o si
 * una versión futura de Zod vuelve a adjuntar el valor.
 */
export function toValidationIssues(issues: readonly ZodLikeIssue[]): ValidationIssue[] {
  return issues.map((issue) => {
    const path = issue.path.map((segment) => String(segment)).join('.');
    const base: ValidationIssue = { path, code: issue.code, message: issue.message };

    const value = 'input' in issue ? issue.input : issue.received;

    // La redacción es la garantía, no el mensaje: sin esto, un email inválido volvería tal cual.
    if (value !== undefined && !isSensitiveField(path)) {
      return { ...base, received: value };
    }
    return base;
  });
}
