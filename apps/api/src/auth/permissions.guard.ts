import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { Permission } from '@crm/contracts';

import { AppError } from '../common/app-error.js';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator.js';
import type { AuthenticatedRequest } from './auth.types.js';

/**
 * Guard de autorización por permisos.
 *
 * Lee los permisos requeridos del decorador `@RequirePermission()` y los compara con los que
 * trae `req.user` (puesto por `DevAuthGuard` hoy, por JWT mañana). No consulta la base de datos:
 * los permisos ya vienen firmados/autorizados en el request.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<readonly Permission[]>(REQUIRE_PERMISSION_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest() as AuthenticatedRequest;
    const granted = request.user?.permissions ?? [];

    const ok = required.every((permission) => granted.includes(permission));
    if (!ok) {
      throw new AppError('FORBIDDEN_PERMISSION', 'Permiso insuficiente para esta operación.', {
        context: { required, granted },
      });
    }

    return true;
  }
}
