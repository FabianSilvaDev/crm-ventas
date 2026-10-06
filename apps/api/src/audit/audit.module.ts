import { Module } from '@nestjs/common';

import { AuditInterceptor } from './audit.interceptor.js';
import { AuditLogRepository } from './audit-log.repository.js';
import { AuditLogService } from './audit-log.service.js';

/**
 * Módulo de auditoría.
 *
 * Exporta `AuditLogService` para uso explícito desde servicios de aplicación, y provee
 * `AuditInterceptor` como provider global. El interceptor se activa registrándolo en
 * `AppModule` con `APP_INTERCEPTOR`.
 */
@Module({
  providers: [AuditLogRepository, AuditLogService, AuditInterceptor],
  exports: [AuditLogService, AuditInterceptor],
})
export class AuditModule {}
