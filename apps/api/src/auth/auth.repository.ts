import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, User as PrismaUser, RefreshToken as PrismaRefreshToken } from '@prisma/client';

import type { StoredRefreshToken, StoredUser } from '../db/types.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Puerto de salida del agregado de autenticación.
 *
 * Al igual que `LeadRepository`, estas interfaces existen para que el swap de implementación de
 * persistencia sea un cambio de adaptador, no una reescritura de negocio.
 */

export interface UserRepository {
  findByEmail(email: string): Promise<StoredUser | undefined>;
  findById(id: string): Promise<StoredUser | undefined>;
  create(data: StoredUser): Promise<StoredUser>;
  update(id: string, patch: Partial<StoredUser>): Promise<StoredUser | undefined>;
  count(): Promise<number>;
}

export interface RefreshTokenRepository {
  findByTokenHash(hash: string): Promise<StoredRefreshToken | undefined>;
  findByFamilyId(familyId: string): Promise<readonly StoredRefreshToken[]>;
  create(data: CreateRefreshTokenInput): Promise<StoredRefreshToken>;
  update(id: string, patch: Partial<StoredRefreshToken>): Promise<StoredRefreshToken | undefined>;
  revokeFamily(familyId: string, revokedAt?: string): Promise<void>;
  revoke(id: string, revokedAt?: string): Promise<StoredRefreshToken | undefined>;
}

export interface CreateRefreshTokenInput {
  readonly userId: string;
  readonly tokenHash: string;
  readonly familyId: string;
  readonly expiresAt: string;
  readonly userAgent?: string | null;
  readonly ip?: string | null;
}

/** Token de inyección del repositorio de usuarios. */
export const USER_REPOSITORY = Symbol('crm:user-repository');

/** Token de inyección del repositorio de refresh tokens. */
export const REFRESH_TOKEN_REPOSITORY = Symbol('crm:refresh-token-repository');

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<StoredUser | undefined> {
    const normalized = email.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalized },
    });
    return user === null ? undefined : toStoredUser(user);
  }

  async findById(id: string): Promise<StoredUser | undefined> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user === null ? undefined : toStoredUser(user);
  }

  async create(data: StoredUser): Promise<StoredUser> {
    const user = await this.prisma.user.create({ data: toPrismaUserCreate(data) });
    return toStoredUser(user);
  }

  async update(id: string, patch: Partial<StoredUser>): Promise<StoredUser | undefined> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: toPrismaUserUpdate(patch),
      });
      return toStoredUser(user);
    } catch (err) {
      if (isRecordNotFound(err)) {
        return undefined;
      }
      throw err;
    }
  }

  async count(): Promise<number> {
    return this.prisma.user.count();
  }
}

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTokenHash(hash: string): Promise<StoredRefreshToken | undefined> {
    const token = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    return token === null ? undefined : toStoredRefreshToken(token);
  }

  async findByFamilyId(familyId: string): Promise<readonly StoredRefreshToken[]> {
    const tokens = await this.prisma.refreshToken.findMany({ where: { familyId } });
    return tokens.map(toStoredRefreshToken);
  }

  async create(data: CreateRefreshTokenInput): Promise<StoredRefreshToken> {
    const token = await this.prisma.refreshToken.create({
      data: {
        id: randomUUID(),
        userId: data.userId,
        tokenHash: data.tokenHash,
        familyId: data.familyId,
        expiresAt: new Date(data.expiresAt),
        revokedAt: null,
        replacedById: null,
        userAgent: data.userAgent ?? null,
        ip: data.ip ?? null,
      },
    });
    return toStoredRefreshToken(token);
  }

  async update(
    id: string,
    patch: Partial<StoredRefreshToken>,
  ): Promise<StoredRefreshToken | undefined> {
    try {
      const token = await this.prisma.refreshToken.update({
        where: { id },
        data: toPrismaRefreshTokenUpdate(patch),
      });
      return toStoredRefreshToken(token);
    } catch (err) {
      if (isRecordNotFound(err)) {
        return undefined;
      }
      throw err;
    }
  }

  async revokeFamily(familyId: string, revokedAt: string = new Date().toISOString()): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(revokedAt) },
    });
  }

  async revoke(
    id: string,
    revokedAt: string = new Date().toISOString(),
  ): Promise<StoredRefreshToken | undefined> {
    return this.update(id, { revokedAt });
  }
}

/** Genera un refresh token opaco de 32 bytes y devuelve el token plano + su hash sha256. */
export function generateRefreshToken(): { readonly token: string; readonly hash: string } {
  const token = randomBytes(32).toString('base64url');
  const hash = hashRefreshToken(token);
  return { token, hash };
}

/** Hash sha256 de un refresh token. El almacenado es este hash, nunca el token plano. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function toStoredUser(user: PrismaUser): StoredUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role,
    status: user.status,
    lastLoginAt: toIsoNullable(user.lastLoginAt),
    failedAttempts: user.failedAttempts,
    lockedUntil: toIsoNullable(user.lockedUntil),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function toPrismaUserCreate(data: StoredUser): Prisma.UserCreateInput {
  return {
    id: data.id,
    email: data.email.toLowerCase(),
    passwordHash: data.passwordHash,
    role: data.role,
    status: data.status,
    lastLoginAt: toDateNullable(data.lastLoginAt),
    failedAttempts: data.failedAttempts,
    lockedUntil: toDateNullable(data.lockedUntil),
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    organization: { connect: { id: data.organizationId } },
  };
}

function toPrismaUserUpdate(patch: Partial<StoredUser>): Prisma.UserUpdateInput {
  const data: Prisma.UserUpdateInput = {};
  if (patch.email !== undefined) data.email = patch.email.toLowerCase();
  if (patch.passwordHash !== undefined) data.passwordHash = patch.passwordHash;
  if (patch.role !== undefined) data.role = patch.role;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.lastLoginAt !== undefined) data.lastLoginAt = toDateNullable(patch.lastLoginAt);
  if (patch.failedAttempts !== undefined) data.failedAttempts = patch.failedAttempts;
  if (patch.lockedUntil !== undefined) data.lockedUntil = toDateNullable(patch.lockedUntil);
  return data;
}

function toStoredRefreshToken(token: PrismaRefreshToken): StoredRefreshToken {
  return {
    id: token.id,
    userId: token.userId,
    tokenHash: token.tokenHash,
    familyId: token.familyId,
    expiresAt: token.expiresAt.toISOString(),
    revokedAt: toIsoNullable(token.revokedAt),
    replacedById: token.replacedById,
    userAgent: token.userAgent,
    ip: token.ip,
    createdAt: token.createdAt.toISOString(),
  };
}

function toPrismaRefreshTokenUpdate(patch: Partial<StoredRefreshToken>): Prisma.RefreshTokenUpdateInput {
  const data: Prisma.RefreshTokenUpdateInput = {};
  if (patch.tokenHash !== undefined) data.tokenHash = patch.tokenHash;
  if (patch.familyId !== undefined) data.familyId = patch.familyId;
  if (patch.expiresAt !== undefined) data.expiresAt = new Date(patch.expiresAt);
  if (patch.revokedAt !== undefined) data.revokedAt = toDateNullable(patch.revokedAt);
  if (patch.replacedById !== undefined) data.replacedById = patch.replacedById;
  if (patch.userAgent !== undefined) data.userAgent = patch.userAgent;
  if (patch.ip !== undefined) data.ip = patch.ip;
  return data;
}

function toIsoNullable(value: Date | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toISOString();
}

function toDateNullable(value: string | null | undefined): Date | null {
  return value === null || value === undefined ? null : new Date(value);
}

function isRecordNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2025'
  );
}
