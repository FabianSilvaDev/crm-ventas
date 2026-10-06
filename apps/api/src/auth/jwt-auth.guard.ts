import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { AppError } from '../common/app-error.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

import { JwtService } from './jwt.service.js';
import type { AuthenticatedRequest } from './auth.types.js';

/**
 * Guard de autenticación por JWT.
 *
 * Lee el access token de la cabecera `Authorization: Bearer <token>`, lo verifica con `jose` y
 * inyecta `req.user` para que `PermissionsGuard` funcione. Es la versión real del autenticación;
 * `DevAuthGuard` sigue disponible como fallback de desarrollo, pero no deben usarse juntos sobre
 * la misma ruta.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtService: JwtService;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.jwtService = new JwtService(env);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<Request>();
    const token = this.extractBearer(request);

    if (token === undefined) {
      throw new AppError('AUTH_TOKEN_INVALID', 'Falta la cabecera Authorization: Bearer.');
    }

    try {
      const claims = await this.jwtService.verifyAccessToken(token);
      (request as AuthenticatedRequest).user = {
        id: claims.sub,
        email: '', // no viene en el JWT; los endpoints que lo necesiten llaman a /auth/me
        role: claims.role as import('@crm/contracts').AuthenticatedUser['role'],
        status: 'ACTIVE',
        organizationId: claims.org,
        permissions: [...claims.permissions],
      };
      return true;
    } catch {
      throw new AppError('AUTH_TOKEN_EXPIRED', 'El access token expiró o es inválido.');
    }
  }

  private extractBearer(request: Request): string | undefined {
    const auth = request.headers.authorization;
    if (auth === undefined || !auth.startsWith('Bearer ')) {
      return undefined;
    }
    return auth.slice(7).trim();
  }
}
