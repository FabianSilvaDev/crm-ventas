import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { AuditLogAction, AuditLogRepository, type AuditLogInput } from './audit-log.repository.js';

/**
 * Contexto de una petición autenticada para la auditoría.
 *
 * Se usa desde el interceptor y desde servicios de aplicación que ya conocen al usuario. Es
 * deliberadamente pequeño: no arrastra `Request` entero para no acoplar el dominio a Express.
 */
export interface AuditActor {
  readonly userId: string;
  readonly organizationId: string;
}

/**
 * Servicio de aplicación de auditoría.
 *
 * Ofrece métodos de conveniencia para los eventos que hoy interesan (`login`, `logout`, creación de
 * usuarios, etc.) y un método genérico `log` para cualquier otro caso. Todos los métodos son
 * fire-and-forget: devuelven la promesa para quien quiera esperarla, pero el repositorio nunca
 * lanza por errores de persistencia.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly repository: AuditLogRepository) {}

  async log(input: AuditLogInput): Promise<void> {
    await this.repository.create(input);
  }

  async logLogin(
    actor: AuditActor,
    success: boolean,
    req: Request,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      ...actor,
      action: success ? 'LOGIN_SUCCEEDED' : 'LOGIN_FAILED',
      ip: this.extractIp(req),
      userAgent: req.headers['user-agent'] ?? null,
      metadata,
    });
  }

  async logLogout(actor: AuditActor, req: Request): Promise<void> {
    await this.log({
      ...actor,
      action: 'LOGOUT',
      ip: this.extractIp(req),
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  async logUserCreated(
    actor: AuditActor,
    createdUserId: string,
    role: string,
    req: Request,
  ): Promise<void> {
    await this.log({
      ...actor,
      action: 'USER_CREATED',
      resource: 'users',
      resourceId: createdUserId,
      metadata: { createdRole: role },
      ip: this.extractIp(req),
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  async logSetup(
    actor: AuditActor,
    organizationId: string,
    req: Request,
  ): Promise<void> {
    await this.log({
      ...actor,
      action: 'SETUP_COMPLETED',
      resource: 'organizations',
      resourceId: organizationId,
      ip: this.extractIp(req),
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  async logRefreshTokenRevoked(
    actor: AuditActor,
    familyId: string,
    reason: string,
    req: Request,
  ): Promise<void> {
    await this.log({
      ...actor,
      action: 'REFRESH_TOKEN_REVOKED',
      resource: 'refresh_tokens',
      resourceId: familyId,
      metadata: { reason },
      ip: this.extractIp(req),
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  private extractIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() ?? null;
    }
    return req.socket.remoteAddress ?? null;
  }
}
