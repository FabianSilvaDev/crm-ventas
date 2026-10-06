import { Prisma } from '@prisma/client';

import { hashPassword } from '../auth/password.js';
import type { Env } from '../config/env.js';
import { seedLeads } from '../leads/leads.repository.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Siembra los datos iniciales si la base está vacía.
 *
 * Se ejecuta en `onModuleInit` de `DbModule`, antes de que cualquier controlador atienda una
 * petición. Si la base ya tiene datos, no hace nada: no sobreescribe datos reales.
 */
export async function seedIfEmpty(env: Env, prisma: PrismaService): Promise<void> {
  const existing = await prisma.lead.count();
  if (existing > 0) {
    return;
  }

  const organizationId = env.DEFAULT_ORGANIZATION_ID ?? '0198f000-0000-7000-8000-000000000001';
  const now = new Date();

  await prisma.organization.upsert({
    where: { id: organizationId },
    create: {
      id: organizationId,
      name: 'Organización de demostración',
      slug: 'demo',
      settings: {},
      createdAt: now,
      updatedAt: now,
    },
    update: {},
  });

  // El OWNER seed solo se crea si se configura OWNER_PASSWORD. Sin ella, la base queda sin usuarios
  // y el setup UI (`POST /auth/setup`) es el camino para crear el primer OWNER. Esto evita un
  // password por defecto en el código fuente y hace el primer arranque seguro por diseño.
  const ownerPassword = env.OWNER_PASSWORD ?? '';
  if (ownerPassword.length > 0) {
    await prisma.user.upsert({
      where: { id: '00000000-0000-7000-8000-000000000001' },
      create: {
        id: '00000000-0000-7000-8000-000000000001',
        organizationId,
        email: 'owner@crm-ventas.local',
        passwordHash: await hashPassword(ownerPassword),
        role: 'OWNER',
        status: 'ACTIVE',
        lastLoginAt: null,
        failedAttempts: 0,
        lockedUntil: null,
        createdAt: now,
        updatedAt: now,
      },
      update: {},
    });
  }

  const leads = seedLeads(organizationId);
  for (const lead of leads) {
    await prisma.identity.upsert({
      where: { id: lead.identityId },
      create: {
        id: lead.identityId,
        organizationId,
        email: lead.identity.email,
        phone: lead.identity.phone,
        firstSeenAt: new Date(lead.createdAt),
        lastSeenAt: new Date(lead.createdAt),
        createdAt: now,
        updatedAt: now,
      },
      update: {},
    });

    await prisma.lead.upsert({
      where: { id: lead.id },
      create: {
        id: lead.id,
        organizationId,
        identityId: lead.identityId,
        contactName: lead.contactName,
        status: lead.status,
        source: lead.source,
        channel: lead.channel,
        score: lead.score,
        ownerUserId: lead.ownerUserId,
        firstResponseAt: lead.firstResponseAt === null ? null : new Date(lead.firstResponseAt),
        convertedAt: lead.convertedAt === null ? null : new Date(lead.convertedAt),
        closedVia: lead.closedVia,
        consentJson:
          lead.consent === null ? Prisma.JsonNull : (lead.consent as unknown as Prisma.InputJsonValue),
        createdAt: new Date(lead.createdAt),
        updatedAt: now,
      },
      update: {},
    });
  }
}
