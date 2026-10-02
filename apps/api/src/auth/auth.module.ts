import { Module } from '@nestjs/common';

import { DevAuthGuard } from './dev-auth.guard.js';
import { PermissionsGuard } from './permissions.guard.js';

/**
 * Módulo de autenticación y autorización.
 *
 * Hoy contiene solo los guards de desarrollo (`DevAuthGuard`) y el guard de permisos
 * (`PermissionsGuard`). Los endpoints reales de `/auth/*` (login, refresh, me) se añaden en Fase 1
 * cuando exista base de datos y JWT; aquí se deja la infraestructura para que los endpoints de
 * negocio del Hito 2 ya puedan declarar `@RequirePermission()`.
 *
 * Los guards se exportan para que cada módulo de dominio los aplique a sus controllers; no se
 * registran globalmente porque `/webhooks/*` y `/health/*` deben seguir siendo públicos.
 */
@Module({
  providers: [DevAuthGuard, PermissionsGuard],
  exports: [DevAuthGuard, PermissionsGuard],
})
export class AuthModule {}
