/**
 * Enum `Permission` — fuente única de verdad de la autorización (`docs/api.md` §4.1).
 *
 * Los 25 valores se copian del documento; no se inventan. El orden reproduce la estructura del
 * catálogo: núcleo, extensión MVP y orquestación.
 */

export enum Permission {
  // ── Núcleo (architecture-review.md §K.2) ─────────────────────────────────────
  READ_PRODUCTS = 'READ_PRODUCTS',
  WRITE_PRODUCTS = 'WRITE_PRODUCTS',
  READ_CAMPAIGNS = 'READ_CAMPAIGNS',
  CREATE_CAMPAIGN = 'CREATE_CAMPAIGN',
  PUBLISH_CAMPAIGN = 'PUBLISH_CAMPAIGN',
  CHANGE_BUDGET = 'CHANGE_BUDGET',
  READ_METRICS = 'READ_METRICS',
  GENERATE_CONTENT = 'GENERATE_CONTENT',
  PUBLISH_CONTENT = 'PUBLISH_CONTENT',
  READ_CUSTOMER_DATA = 'READ_CUSTOMER_DATA',
  EXPORT_DATA = 'EXPORT_DATA',
  MANAGE_AGENTS = 'MANAGE_AGENTS',
  READ_AUDIT = 'READ_AUDIT',
  MANAGE_CONNECTORS = 'MANAGE_CONNECTORS',
  DELETE_ANY = 'DELETE_ANY',

  // ── Extensión MVP exigida por el catálogo de §9 ────────────────────────────
  WRITE_CUSTOMER_DATA = 'WRITE_CUSTOMER_DATA',
  WRITE_CAMPAIGN = 'WRITE_CAMPAIGN',
  READ_CONTENT = 'READ_CONTENT',
  WRITE_CONTENT = 'WRITE_CONTENT',
  MANAGE_BRAND = 'MANAGE_BRAND',
  MANAGE_SEO = 'MANAGE_SEO',
  WRITE_ORDERS = 'WRITE_ORDERS',
  EXECUTE_AGENT = 'EXECUTE_AGENT',
  MANAGE_SYSTEM = 'MANAGE_SYSTEM',

  // ── Orquestación (ADR-020) ─────────────────────────────────────────────────
  ORCHESTRATE_AGENTS = 'ORCHESTRATE_AGENTS',
}

/** Conjunto completo como array, útil para guards y tests. */
export const ALL_PERMISSIONS = Object.values(Permission) as readonly Permission[];

/** Permisos que nunca se conceden a un agente en el MVP (ADR-020). */
export const MVP_FORBIDDEN_AGENT_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.PUBLISH_CAMPAIGN,
  Permission.CHANGE_BUDGET,
  Permission.DELETE_ANY,
  Permission.MANAGE_AGENTS,
  Permission.MANAGE_SYSTEM,
  Permission.EXPORT_DATA,
]);

/** Permisos que exigen aprobación cuando una tool los declara (ADR-005). */
export const APPROVAL_REQUIRED_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.PUBLISH_CONTENT,
]);
