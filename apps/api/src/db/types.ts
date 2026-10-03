/**
 * Tipos internos de las entidades que se persisten en archivos JSON.
 *
 * Son una versión reducida de `docs/database.md`: lo suficiente para desarrollar la Fase 1 sin
 * Prisma, pero alineada con el esquema relacional final. Cuando llegue la migración a Postgres,
 * estos tipos se convierten en el modelo de Prisma.
 */

export interface StoredOrganization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly settings: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoredUser {
  readonly id: string;
  readonly organizationId: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly role: string;
  readonly status: string;
  readonly lastLoginAt: string | null;
  readonly failedAttempts: number;
  readonly lockedUntil: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoredIdentity {
  readonly id: string;
  readonly organizationId: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
