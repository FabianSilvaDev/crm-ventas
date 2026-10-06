import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';

import { AuditLogService } from './audit-log.service.js';

/**
 * Interceptor global para auditar **mutaciones autenticadas**.
 *
 * ## Qué audita y qué no
 *
 - Solo métodos que cambian estado: `POST`, `PUT`, `PATCH`, `DELETE`.
 - Solo cuando `req.user` existe: rutas públicas (login, refresh, setup inicial, webhooks) quedan
   fuera. Esas rutas ya se auditan explícitamente desde `AuthService`.
 - No audita `GET`, `HEAD`, `OPTIONS`: la lectura no altera el sistema y no es lo que debe quedar
   trazable ante una auditoría de cambios.

 * ## Cómo decide el `action`
 *
 * Hoy el interceptor no conoce la semántica exacta de cada endpoint, así que registra un evento
 * genérico `OTHER` con la ruta y el método como metadata. Eso ya cumple el objetivo mínimo de Fase
 * 1: tener una tabla de auditoría poblada y un mecanismo de interceptación. Cuando cada dominio
 * declare su propio decorador de auditoría, este interceptor puede evolucionar a algo más específico
 * sin tocar los controllers.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = this.extractRequest(context);

    if (request === null) {
      return next.handle();
    }

    const user = (request as { user?: { id: string; organizationId: string } }).user;
    if (user === undefined) {
      return next.handle();
    }

    const method = request.method?.toUpperCase() ?? '';
    if (!this.isMutation(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          void this.audit.log({
            userId: user.id,
            organizationId: user.organizationId,
            action: 'OTHER',
            resource: this.resourceName(request),
            metadata: {
              method,
              path: request.path,
              route: context.getClass().name + '.' + context.getHandler().name,
            },
            ip: this.extractIp(request),
            userAgent: request.headers['user-agent'] ?? null,
          });
        },
      }),
    );
  }

  private extractRequest(context: ExecutionContext): Request | null {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    return request ?? null;
  }

  private isMutation(method: string): boolean {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  }

  private resourceName(req: Request): string {
    // La primera parte de la ruta después de `/api/v1/` es el recurso. Ejemplo:
    // `/api/v1/leads/123` → `leads`.
    const parts = req.path.replace(/^\/(api\/v1\/)?/, '').split('/');
    return parts[0] ?? 'unknown';
  }

  private extractIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() ?? null;
    }
    return req.socket.remoteAddress ?? null;
  }
}
