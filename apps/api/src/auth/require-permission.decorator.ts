import { SetMetadata } from '@nestjs/common';

import type { Permission } from '@crm/contracts';

/**
 * Clave de metadatos donde `PermissionsGuard` lee los permisos requeridos.
 *
 * Se exporta para los tests que quieren inspeccionar los metadatos sin depender del string literal.
 */
export const REQUIRE_PERMISSION_KEY = 'crm:require-permission';

/**
 * Declara que un handler o controller exige **todos** los permisos listados (AND).
 *
 * Ejemplo: `@RequirePermission(Permission.READ_CUSTOMER_DATA)`.
 */
export const RequirePermission = (...permissions: readonly Permission[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
