import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { ALL_PERMISSIONS, Permission } from '@crm/contracts';

import { AppError } from '../common/app-error.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

/** Cabecera que transporta el token estático de desarrollo. */
const DEV_API_TOKEN_HEADER = 'X-Dev-Api-Token';

/**
 * Guard de autenticación de desarrollo.
 *
 * Protege los endpoints de negocio antes de que exista autenticación real (JWT + refresh token).
 * Solo se permite fuera de producción; en producción el arranque falla si `DEV_API_TOKEN` está
 * configurado, y este guard rechaza cualquier intento por si acaso.
 *
 * Al validar, inyecta un usuario OWNER con todos los permisos, usando `DEFAULT_ORGANIZATION_ID`.
 * Así los controllers pueden leer `req.user` y `PermissionsGuard` funciona sin cambios cuando la
 * autenticación real llegue en Fase 1.
 */
@Injectable()
export class DevAuthGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest() as Request & { user?: unknown };

    if (this.env.NODE_ENV === 'production') {
      throw new AppError(
        'AUTH_TOKEN_INVALID',
        'La autenticación de desarrollo no está disponible en producción.',
      );
    }

    const configuredToken = this.env.DEV_API_TOKEN;
    if (configuredToken === undefined) {
      throw new AppError(
        'AUTH_INVALID_CREDENTIALS',
        'No hay token de desarrollo configurado. La ruta no responde sin autenticación.',
      );
    }

    const providedToken = this.leerToken(request);
    if (providedToken !== configuredToken) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Token de desarrollo inválido.');
    }

    request.user = {
      id: '00000000-0000-7000-8000-000000000001',
      email: 'owner@crm-ventas.local',
      role: 'OWNER',
      status: 'ACTIVE',
      organizationId:
        this.env.DEFAULT_ORGANIZATION_ID ?? '0198f000-0000-7000-8000-000000000001',
      permissions: [...ALL_PERMISSIONS],
    };

    return true;
  }

  private leerToken(request: Request): string | undefined {
    const raw = request.headers[DEV_API_TOKEN_HEADER.toLowerCase()];
    if (typeof raw === 'string') {
      return raw;
    }
    if (Array.isArray(raw) && raw.length > 0) {
      return raw[0];
    }
    return undefined;
  }
}
