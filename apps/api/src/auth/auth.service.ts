import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';

import { ALL_PERMISSIONS, Permission } from '@crm/contracts';
import type {
  AuthenticatedUser,
  LoginRequest,
  LoginResponse,
  MeResponse,
  RefreshResponse,
  RegisterOwnerRequest,
  RegisterOwnerResponse,
  RegisterRequest,
  RegisterResponse,
  SetupRequest,
} from '@crm/contracts';

import { AuditLogService, type AuditActor } from '../audit/audit-log.service.js';
import { AppError } from '../common/app-error.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import type { StoredRefreshToken, StoredUser } from '../db/types.js';
import { PrismaService } from '../prisma/prisma.service.js';

import {
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
  type RefreshTokenRepository,
  type UserRepository,
  generateRefreshToken,
  hashRefreshToken,
} from './auth.repository.js';
import { JwtService } from './jwt.service.js';
import { hashPassword, verifyPassword } from './password.js';

/**
 * Resultado interno de un login exitoso, antes de montar la respuesta HTTP.
 */
interface LoginResult {
  readonly user: StoredUser;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

/**
 * Servicio de aplicación de autenticación.
 *
 * Implementa `docs/api.md` §3: login, refresh, logout, me, register y setup. La lógica de negocio
 * aquí es deliberadamente fina: validar credenciales, rotar tokens y responder. El modelo de roles y
 * permisos vive en `AuthenticatedUser` (`@crm/contracts`).
 */
@Injectable()
export class AuthService {
  private readonly jwtService: JwtService;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {
    this.jwtService = new JwtService(env);
  }

  async login(data: LoginRequest, req: Request): Promise<LoginResult> {
    const user = await this.users.findByEmail(data.email);

    // No distinguir email inexistente de password incorrecta (`docs/api.md` §3.7).
    if (user === undefined) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Credenciales inválidas.');
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Cuenta inactiva.');
    }

    if (user.lockedUntil !== null && new Date(user.lockedUntil) > new Date()) {
      throw new AppError(
        'AUTH_ACCOUNT_LOCKED',
        'La cuenta está bloqueada temporalmente por intentos fallidos.',
      );
    }

    const valid = await verifyPassword(user.passwordHash, data.password);
    if (!valid) {
      await this.recordFailedAttempt(user, req);
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Credenciales inválidas.');
    }

    const updated = await this.users.update(user.id, {
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date().toISOString(),
    });

    if (updated === undefined) {
      throw new AppError('INTERNAL_ERROR', 'No se pudo actualizar el usuario tras el login.');
    }

    const result = await this.createSession(updated, req);

    void this.audit.logLogin(
      this.actor(updated),
      true,
      req,
      { via: 'password' },
    );

    return result;
  }

  async refresh(
    refreshTokenPlain: string | undefined,
    req: Request,
  ): Promise<{ readonly response: RefreshResponse; readonly refreshToken: string }> {
    if (refreshTokenPlain === undefined) {
      throw new AppError('REFRESH_TOKEN_INVALID', 'No se envió refresh token.');
    }

    const tokenHash = hashRefreshToken(refreshTokenPlain);
    const token = await this.refreshTokens.findByTokenHash(tokenHash);

    if (token === undefined) {
      throw new AppError('REFRESH_TOKEN_INVALID', 'El refresh token no existe.');
    }

    if (token.revokedAt !== null) {
      // Reuso detectado: revocar toda la familia y auditar (`docs/api.md` §3.4).
      const user = await this.users.findById(token.userId);
      await this.refreshTokens.revokeFamily(token.familyId);
      if (user !== undefined) {
        void this.audit.logRefreshTokenRevoked(
          this.actor(user),
          token.familyId,
          'reuse_detected',
          req,
        );
      }
      throw new AppError('REFRESH_TOKEN_REUSE_DETECTED', 'Se detectó reuso de un token de refresco.');
    }

    if (new Date(token.expiresAt) < new Date()) {
      throw new AppError('REFRESH_TOKEN_INVALID', 'El refresh token expiró.');
    }

    const user = await this.users.findById(token.userId);
    if (user === undefined || user.status !== 'ACTIVE') {
      throw new AppError('REFRESH_TOKEN_INVALID', 'El usuario asociado al token no está activo.');
    }

    // Verificar Origin contra WEB_ORIGIN (`docs/api.md` §3.7).
    this.requireSameOrigin(req);

    // Rotar: el actual queda revocado y apunta al nuevo.
    const { token: newPlain, hash: newHash } = generateRefreshToken();
    const familyId = token.familyId;
    const expiresAt = this.refreshTokenExpiry();

    const newToken = await this.refreshTokens.create({
      userId: user.id,
      tokenHash: newHash,
      familyId,
      expiresAt,
      userAgent: req.headers['user-agent'] ?? null,
      ip: this.extractIp(req),
    });

    await this.refreshTokens.revoke(token.id);
    await this.refreshTokens.update(token.id, { replacedById: newToken.id });

    const { token: accessToken, expiresIn } = await this.jwtService.signAccessToken({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      permissions: this.permissionsForRole(user.role),
    });

    return {
      response: {
        accessToken,
        tokenType: 'Bearer',
        expiresIn,
        user: { id: user.id, permissions: [...this.permissionsForRole(user.role)] },
      },
      refreshToken: newPlain,
    };
  }

  async logout(refreshTokenPlain: string | undefined, req: Request): Promise<void> {
    if (refreshTokenPlain === undefined) {
      return;
    }

    const tokenHash = hashRefreshToken(refreshTokenPlain);
    const token = await this.refreshTokens.findByTokenHash(tokenHash);

    if (token !== undefined) {
      await this.refreshTokens.revokeFamily(token.familyId);
      const user = await this.users.findById(token.userId);
      if (user !== undefined) {
        void this.audit.logLogout(this.actor(user), req);
      }
    }
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.users.findById(userId);
    if (user === undefined) {
      throw new AppError('RESOURCE_NOT_FOUND', 'No existe el usuario.');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
    });
    if (organization === null) {
      throw new Error(`Organización ${user.organizationId} no encontrada.`);
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role as MeResponse['role'],
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      permissions: [...this.permissionsForRole(user.role)],
      lastLoginAt: user.lastLoginAt,
    };
  }

  async countUsers(): Promise<number> {
    return this.users.count();
  }

  buildAuthenticatedUser(user: StoredUser): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role as AuthenticatedUser['role'],
      status: user.status as AuthenticatedUser['status'],
      organizationId: user.organizationId,
      permissions: [...this.permissionsForRole(user.role)],
    };
  }

  async register(
    data: RegisterRequest,
    organizationId: string,
    actor: AuditActor,
    req: Request,
  ): Promise<RegisterResponse> {
    // MVP: registro intra-organización protegido. Solo se permite crear AGENT.
    const existing = await this.users.findByEmail(data.email);
    if (existing !== undefined) {
      throw new AppError('STATE_CONFLICT', 'Ya existe un usuario con ese email.');
    }

    const now = new Date().toISOString();
    const user = await this.users.create({
      id: randomUUID(),
      organizationId,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      role: data.role,
      status: 'ACTIVE',
      lastLoginAt: null,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
    });

    void this.audit.logUserCreated(actor, user.id, user.role, req);

    return this.me(user.id);
  }

  async registerOwner(
    data: RegisterOwnerRequest,
    organizationId: string,
    actor: AuditActor,
    req: Request,
  ): Promise<RegisterOwnerResponse> {
    const existing = await this.users.findByEmail(data.email);
    if (existing !== undefined) {
      throw new AppError('STATE_CONFLICT', 'Ya existe un usuario con ese email.');
    }

    const now = new Date().toISOString();
    const user = await this.users.create({
      id: randomUUID(),
      organizationId,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      role: 'OWNER',
      status: 'ACTIVE',
      lastLoginAt: null,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
    });

    void this.audit.logUserCreated(actor, user.id, user.role, req);

    return this.me(user.id);
  }

  /**
   * Crea el primer OWNER y la organización por defecto. Solo funciona cuando no hay usuarios.
   *
   * El endpoint es público pero fall-closed: si ya existe un usuario, el servidor devuelve
   * `STATE_CONFLICT` sin tocar nada. Esto permite exponer la pantalla de setup en el primer arranque
   * sin dejar una puerta abierta una vez configurado.
   */
  async setup(data: SetupRequest, req: Request): Promise<LoginResult> {
    const userCount = await this.users.count();
    if (userCount > 0) {
      throw new AppError('STATE_CONFLICT', 'La configuración inicial ya fue completada.');
    }

    const now = new Date().toISOString();
    const organizationId = this.env.DEFAULT_ORGANIZATION_ID ?? randomUUID();
    const organizationName = data.organizationName?.trim() || 'Organización principal';
    const organizationSlug = this.slugify(organizationName);

    await this.prisma.organization.upsert({
      where: { id: organizationId },
      create: {
        id: organizationId,
        name: organizationName,
        slug: organizationSlug,
        settings: {},
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
      update: {},
    });

    const owner = await this.users.create({
      id: randomUUID(),
      organizationId,
      email: data.email.toLowerCase(),
      passwordHash: await hashPassword(data.password),
      role: 'OWNER',
      status: 'ACTIVE',
      lastLoginAt: null,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
    });

    const result = await this.createSession(owner, req);

    void this.audit.logSetup(this.actor(owner), organizationId, req);

    return result;
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 60) || 'principal';
  }

  private async createSession(user: StoredUser, req: Request): Promise<LoginResult> {
    const { token: accessToken, expiresIn } = await this.jwtService.signAccessToken({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      permissions: this.permissionsForRole(user.role),
    });

    const { token: refreshTokenPlain, hash } = generateRefreshToken();
    await this.refreshTokens.create({
      userId: user.id,
      tokenHash: hash,
      familyId: randomUUID(),
      expiresAt: this.refreshTokenExpiry(),
      userAgent: req.headers['user-agent'] ?? null,
      ip: this.extractIp(req),
    });

    return { user, accessToken, refreshToken: refreshTokenPlain, expiresIn };
  }

  private async recordFailedAttempt(user: StoredUser, req: Request): Promise<void> {
    const attempts = user.failedAttempts + 1;
    const maxAttempts = this.env.MAX_FAILED_ATTEMPTS;

    if (attempts >= maxAttempts) {
      const backoffMinutes = this.lockoutBackoff(attempts);
      const lockedUntil = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
      await this.users.update(user.id, { failedAttempts: attempts, lockedUntil });
    } else {
      await this.users.update(user.id, { failedAttempts: attempts });
    }

    void this.audit.logLogin(this.actor(user), false, req, { attempts });
  }

  private actor(user: StoredUser): AuditActor {
    return {
      userId: user.id,
      organizationId: user.organizationId,
    };
  }

  private lockoutBackoff(attempts: number): number {
    // Exponencial: 15, 30, 60, 120... con tope 24 h.
    const exponent = Math.max(0, attempts - this.env.MAX_FAILED_ATTEMPTS);
    return Math.min(15 * 2 ** exponent, 24 * 60);
  }

  private refreshTokenExpiry(): string {
    const ttlMs = this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ttlMs).toISOString();
  }

  private requireSameOrigin(req: Request): void {
    const origin = req.headers.origin ?? req.headers.referer;
    if (origin === undefined) {
      return;
    }

    const allowed = this.env.WEB_ORIGIN;
    if (!origin.startsWith(allowed)) {
      throw new AppError('AUTH_TOKEN_INVALID', 'Origen no permitido para refresh.');
    }
  }

  private extractIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() ?? null;
    }
    return req.socket.remoteAddress ?? null;
  }

  permissionsForRole(role: string): readonly Permission[] {
    // MVP: OWNER tiene todos los permisos. Otros roles se añaden con su propio ADR.
    if (role === 'OWNER') {
      return [...ALL_PERMISSIONS];
    }
    return [];
  }
}
