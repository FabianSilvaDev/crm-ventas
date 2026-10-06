import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Datos necesarios para escribir una fila de auditoría.
 *
 * Se separa del modelo Prisma para no exponer detalles de persistencia en el servicio de
 * aplicación: la capa de dominio decide **qué** se audita, el repositorio decide **cómo** se
 * guarda.
 */
export interface AuditLogInput {
  readonly organizationId?: string | null;
  readonly userId?: string | null;
  readonly action: AuditLogAction;
  readonly resource?: string;
  readonly resourceId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly ip?: string | null;
  readonly userAgent?: string | null;
}

export type AuditLogAction =
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'LOGIN_SUCCEEDED'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'SETUP_COMPLETED'
  | 'PASSWORD_CHANGED'
  | 'REFRESH_TOKEN_REVOKED'
  | 'LEAD_CREATED'
  | 'LEAD_UPDATED'
  | 'LEAD_CONVERTED'
  | 'OTHER';

/**
 * Persistencia de auditoría.
 *
 * Es un repositorio delgado sobre `audit_logs`: la única lógica que contiene es convertir el
 * `AuditLogAction` del dominio al enum nativo de Prisma y asegurar que los errores de escritura no
 * escapen hacia arriba. La auditoría no debe poder romper una operación de negocio.
 */
@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: AuditLogInput): Promise<void> {
    const data: Prisma.AuditLogCreateInput = {
      action: input.action as Prisma.AuditLogCreateInput['action'],
      organization: input.organizationId
        ? { connect: { id: input.organizationId } }
        : undefined,
      user: input.userId ? { connect: { id: input.userId } } : undefined,
      resource: input.resource ?? null,
      resourceId: input.resourceId ?? null,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    };

    try {
      await this.prisma.auditLog.create({ data });
    } catch {
      // La auditoría es secundaria: un fallo aquí no debe matar la petición del usuario. Se deja
      // constar en los logs del proceso; el evento se pierde, pero la operación principal sigue.
    }
  }
}
