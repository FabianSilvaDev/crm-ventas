import type { UserRole, UserStatus } from '@crm/contracts';

/**
 * Tipos internos de las entidades persistidas por Prisma.
 *
 * Son una capa delgada sobre el cliente Prisma: los servicios de aplicación los usan para no depender
 * directamente del tipo `Prisma.UserGetPayload`. Los repositorios se encargan de convertir entre el
 * modelo Prisma y estos tipos.
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
  readonly role: UserRole;
  readonly status: UserStatus;
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

/**
 * Refresh token opaco.
 *
 * Se guarda el **hash** del token (`tokenHash`), nunca el token en claro. El token plano solo vive
 * en la cookie `__Host-crm_rt` durante su vida.
 */
export interface StoredRefreshToken {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly replacedById: string | null;
  readonly userAgent: string | null;
  readonly ip: string | null;
  readonly createdAt: string;
}
