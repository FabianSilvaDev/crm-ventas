import type { Lead } from '@crm/contracts';

import type { Env } from '../config/env.js';
import { seedLeads } from '../leads/leads.repository.js';

import type { JsonDb } from './json-db.js';
import type { StoredIdentity, StoredOrganization, StoredUser } from './types.js';

/**
 * Siembra los datos iniciales si la base está vacía.
 *
 * Se ejecuta en `onModuleInit` de `DbModule`, antes de que cualquier controlador atienda una
 * petición. Si los archivos JSON ya existen, no hace nada: no sobreescribe datos reales.
 */
export async function seedIfEmpty(
  env: Env,
  deps: {
    readonly leadsDb: JsonDb<Lead>;
    readonly identitiesDb: JsonDb<StoredIdentity>;
    readonly usersDb: JsonDb<StoredUser>;
    readonly organizationsDb: JsonDb<StoredOrganization>;
  },
): Promise<void> {
  const existing = await deps.leadsDb.count();
  if (existing > 0) {
    return;
  }

  const organizationId = env.DEFAULT_ORGANIZATION_ID ?? '0198f000-0000-7000-8000-000000000001';
  const now = new Date().toISOString();

  const organization: StoredOrganization = {
    id: organizationId,
    name: 'Organización de demostración',
    slug: 'demo',
    settings: {},
    createdAt: now,
    updatedAt: now,
  };
  await deps.organizationsDb.upsert(organization);

  const owner: StoredUser = {
    id: '00000000-0000-7000-8000-000000000001',
    organizationId,
    email: 'owner@crm-ventas.local',
    passwordHash: '',
    role: 'OWNER',
    status: 'ACTIVE',
    lastLoginAt: null,
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
  };
  await deps.usersDb.upsert(owner);

  const leads = seedLeads(organizationId);
  for (const lead of leads) {
    const identity: StoredIdentity = {
      id: lead.identityId,
      organizationId,
      email: lead.identity.email,
      phone: lead.identity.phone,
      firstSeenAt: lead.createdAt,
      lastSeenAt: lead.createdAt,
      createdAt: now,
      updatedAt: now,
    };
    await deps.identitiesDb.upsert(identity);
    await deps.leadsDb.insert(lead);
  }
}
