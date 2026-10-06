import type { AuthenticatedUser } from '@crm/contracts';
import type { Request } from 'express';

/**
 * Request con usuario autenticado. El guard `DevAuthGuard` lo inyecta; el resto de guards y
 * controllers lo consumen tipado.
 */
export interface RequestWithUser {
  user: AuthenticatedUser;
}

/** Request de Express con el usuario tipado. */
export type AuthenticatedRequest = Request & RequestWithUser;
