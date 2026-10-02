import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedUser } from '@crm/contracts';

import type { AuthenticatedRequest } from './auth.types.js';

/**
 * Inyecta el usuario autenticado en un handler.
 *
 * ```ts
 * async update(@CurrentUser() user: AuthenticatedUser) { … }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest() as AuthenticatedRequest;
    return request.user;
  },
);
