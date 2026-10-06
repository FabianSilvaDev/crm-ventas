import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { DevAuthGuard } from './dev-auth.guard.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PermissionsGuard } from './permissions.guard.js';
import {
  PrismaRefreshTokenRepository,
  PrismaUserRepository,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
} from './auth.repository.js';

/**
 * Módulo de autenticación y autorización.
 *
 * Expone los endpoints reales de `/auth/*` (login, refresh, logout, me) con JWT + refresh token
 * opaco, además de los guards `JwtAuthGuard`, `PermissionsGuard` y el guard de desarrollo
 * `DevAuthGuard`.
 */
@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: PrismaRefreshTokenRepository,
    },
    JwtAuthGuard,
    DevAuthGuard,
    PermissionsGuard,
  ],
  exports: [JwtAuthGuard, DevAuthGuard, PermissionsGuard],
})
export class AuthModule {}
