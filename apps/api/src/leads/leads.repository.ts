import { randomUUID } from 'node:crypto';

import type { ClosedVia, Consent, IdentitySummary, Lead, LeadCreate, LeadUpdate } from '@crm/contracts';

import type { JsonDb } from '../db/json-db.js';
import type { StoredIdentity } from '../db/types.js';

/**
 * Puerto de salida del agregado Lead.
 *
 * Es async porque toda persistencia real (JSON hoy, Prisma mañana) es asíncrona. Los controladores y
 * servicios deben esperar las promesas, pero el contrato no cambia cuando se cambie la implementación.
 */
export interface LeadRepository {
  list(options: ListOptions): Promise<LeadListResult>;
  findById(id: string): Promise<Lead | undefined>;
  create(data: CreateLeadInput): Promise<Lead>;
  update(id: string, data: LeadUpdate): Promise<Lead | undefined>;
  convert(id: string): Promise<Lead | undefined>;
  firstResponse(id: string, closedVia?: ClosedVia | null): Promise<Lead | undefined>;
}

/**
 * Entrada completa de creación. El contrato solo transporta lo que el cliente envía; el service
 * añade organizationId, identityId, contactName e identity antes de llamar al repositorio.
 */
export interface CreateLeadInput extends LeadCreate {
  readonly organizationId: string;
  readonly identityId: string;
  readonly contactName: string | null;
  readonly identity: IdentitySummary;
}

export interface ListOptions {
  readonly limit: number;
  readonly cursor?: string;
  readonly status?: string;
  readonly channel?: string;
}

export interface LeadListResult {
  readonly items: readonly Lead[];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

/** Token de inyección del repositorio de leads. */
export const LEAD_REPOSITORY = Symbol('crm:lead-repository');

/**
 * Repositorio en memoria de leads.
 *
 * Se conserva para tests unitarios rápidos que no necesitan tocar disco. La app real usa
 * `JsonLeadRepository`.
 */
export class InMemoryLeadRepository implements LeadRepository {
  private readonly leads = new Map<string, Lead>();

  constructor(seed: readonly Lead[] = []) {
    for (const lead of seed) {
      this.leads.set(lead.id, lead);
    }
  }

  async list(options: ListOptions): Promise<LeadListResult> {
    const all = [...this.leads.values()].sort(compararPorCreatedAtDesc);

    const filtered = all.filter((lead) => {
      if (options.status !== undefined && lead.status !== options.status) {
        return false;
      }
      if (options.channel !== undefined && lead.channel !== options.channel) {
        return false;
      }
      return true;
    });

    let startIndex = 0;
    if (options.cursor !== undefined) {
      const decoded = decodificarCursor(options.cursor);
      if (decoded !== null) {
        startIndex = this.encontrarIndice(filtered, decoded.createdAt, decoded.id) + 1;
      }
    }

    const items = filtered.slice(startIndex, startIndex + options.limit);
    const hasMore = filtered.length > startIndex + items.length;
    const nextCursor =
      hasMore && items.length > 0
        ? codificarCursor(items[items.length - 1]!.createdAt, items[items.length - 1]!.id)
        : null;

    return { items, hasMore, nextCursor };
  }

  async findById(id: string): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async create(data: CreateLeadInput): Promise<Lead> {
    const now = new Date().toISOString();
    const lead: Lead = {
      id: randomUUID(),
      organizationId: data.organizationId,
      identityId: data.identityId,
      contactName: data.contactName,
      status: data.status,
      source: data.source,
      channel: data.channel,
      score: data.score ?? null,
      ownerUserId: data.ownerUserId ?? null,
      firstResponseAt: null,
      convertedAt: null,
      closedVia: null,
      consent: data.consent ?? null,
      createdAt: now,
      identity: data.identity,
    };

    this.leads.set(lead.id, lead);
    return lead;
  }

  async update(id: string, data: LeadUpdate): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (lead === undefined) {
      return undefined;
    }

    const actualizado: Lead = {
      ...lead,
      ...(data.status !== undefined && { status: data.status }),
      ...(data.ownerUserId !== undefined && { ownerUserId: data.ownerUserId }),
      ...(data.score !== undefined && { score: data.score }),
      ...(data.closedVia !== undefined && { closedVia: data.closedVia }),
      ...(data.consent !== undefined && { consent: data.consent }),
    };

    this.leads.set(id, actualizado);
    return actualizado;
  }

  async convert(id: string): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (lead === undefined) {
      return undefined;
    }

    const ahora = new Date().toISOString();
    const actualizado: Lead = {
      ...lead,
      status: 'CONVERTED',
      convertedAt: lead.convertedAt ?? ahora,
    };

    this.leads.set(id, actualizado);
    return actualizado;
  }

  async firstResponse(id: string, closedVia?: ClosedVia | null): Promise<Lead | undefined> {
    const lead = this.leads.get(id);
    if (lead === undefined) {
      return undefined;
    }

    const ahora = new Date().toISOString();
    const actualizado: Lead = {
      ...lead,
      firstResponseAt: lead.firstResponseAt ?? ahora,
      ...(closedVia !== undefined && lead.closedVia === null ? { closedVia } : {}),
    };

    this.leads.set(id, actualizado);
    return actualizado;
  }

  private encontrarIndice(leads: readonly Lead[], createdAt: string, id: string): number {
    return leads.findIndex(
      (lead) => lead.createdAt < createdAt || (lead.createdAt === createdAt && lead.id < id),
    );
  }
}

/**
 * Repositorio de leads que persiste en archivos JSON.
 *
 * Mantiene `leads.json` y, para mantener la tabla `identities` sincronizada, `identities.json`.
 * Cuando llegue Prisma, este repositorio se reemplaza por `PrismaLeadRepository` sin tocar el service.
 */
export class JsonLeadRepository implements LeadRepository {
  constructor(
    private readonly leadsDb: JsonDb<Lead>,
    private readonly identitiesDb: JsonDb<StoredIdentity>,
  ) {}

  async list(options: ListOptions): Promise<LeadListResult> {
    const all = [...(await this.leadsDb.findAll())].sort(compararPorCreatedAtDesc);

    const filtered = all.filter((lead) => {
      if (options.status !== undefined && lead.status !== options.status) {
        return false;
      }
      if (options.channel !== undefined && lead.channel !== options.channel) {
        return false;
      }
      return true;
    });

    let startIndex = 0;
    if (options.cursor !== undefined) {
      const decoded = decodificarCursor(options.cursor);
      if (decoded !== null) {
        startIndex = this.encontrarIndice(filtered, decoded.createdAt, decoded.id) + 1;
      }
    }

    const items = filtered.slice(startIndex, startIndex + options.limit);
    const hasMore = filtered.length > startIndex + items.length;
    const nextCursor =
      hasMore && items.length > 0
        ? codificarCursor(items[items.length - 1]!.createdAt, items[items.length - 1]!.id)
        : null;

    return { items, hasMore, nextCursor };
  }

  async findById(id: string): Promise<Lead | undefined> {
    return this.leadsDb.findById(id);
  }

  async create(data: CreateLeadInput): Promise<Lead> {
    const now = new Date().toISOString();
    const lead: Lead = {
      id: randomUUID(),
      organizationId: data.organizationId,
      identityId: data.identityId,
      contactName: data.contactName,
      status: data.status,
      source: data.source,
      channel: data.channel,
      score: data.score ?? null,
      ownerUserId: data.ownerUserId ?? null,
      firstResponseAt: null,
      convertedAt: null,
      closedVia: null,
      consent: data.consent ?? null,
      createdAt: now,
      identity: data.identity,
    };

    const identity: StoredIdentity = {
      id: data.identityId,
      organizationId: data.organizationId,
      email: data.identity.email,
      phone: data.identity.phone,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.identitiesDb.upsert(identity);
    await this.leadsDb.insert(lead);
    return lead;
  }

  async update(id: string, data: LeadUpdate): Promise<Lead | undefined> {
    const lead = await this.leadsDb.findById(id);
    if (lead === undefined) {
      return undefined;
    }

    const actualizado: Lead = {
      ...lead,
      ...(data.status !== undefined && { status: data.status }),
      ...(data.ownerUserId !== undefined && { ownerUserId: data.ownerUserId }),
      ...(data.score !== undefined && { score: data.score }),
      ...(data.closedVia !== undefined && { closedVia: data.closedVia }),
      ...(data.consent !== undefined && { consent: data.consent }),
    };

    return this.leadsDb.update(id, actualizado);
  }

  async convert(id: string): Promise<Lead | undefined> {
    const lead = await this.leadsDb.findById(id);
    if (lead === undefined) {
      return undefined;
    }

    const ahora = new Date().toISOString();
    return this.leadsDb.update(id, {
      status: 'CONVERTED',
      convertedAt: lead.convertedAt ?? ahora,
    });
  }

  async firstResponse(id: string, closedVia?: ClosedVia | null): Promise<Lead | undefined> {
    const lead = await this.leadsDb.findById(id);
    if (lead === undefined) {
      return undefined;
    }

    const ahora = new Date().toISOString();
    const patch: Partial<Lead> = {
      firstResponseAt: lead.firstResponseAt ?? ahora,
    };
    if (closedVia !== undefined && lead.closedVia === null) {
      patch.closedVia = closedVia;
    }

    return this.leadsDb.update(id, patch);
  }

  private encontrarIndice(leads: readonly Lead[], createdAt: string, id: string): number {
    return leads.findIndex(
      (lead) => lead.createdAt < createdAt || (lead.createdAt === createdAt && lead.id < id),
    );
  }
}

function compararPorCreatedAtDesc(a: Lead, b: Lead): number {
  if (a.createdAt > b.createdAt) return -1;
  if (a.createdAt < b.createdAt) return 1;
  return a.id > b.id ? -1 : a.id < b.id ? 1 : 0;
}

interface CursorPayload {
  readonly createdAt: string;
  readonly id: string;
}

function codificarCursor(createdAt: string, id: string): string {
  const json = JSON.stringify({ createdAt, id });
  return Buffer.from(json, 'utf8').toString('base64url');
}

function decodificarCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as CursorPayload).createdAt === 'string' &&
      typeof (parsed as CursorPayload).id === 'string'
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/** Consentimiento de ejemplo, reutilizable en los seeds. */
function consentimientoDeEjemplo(granted: boolean): Consent {
  return {
    granted,
    basis: 'consent',
    textVersion: 'privacy-v1',
    capturedAt: new Date().toISOString(),
  };
}

/** Leads de demostración para que la pantalla no arranque vacía. */
export function seedLeads(organizationId: string): readonly Lead[] {
  const ahora = new Date().toISOString();

  return [
    {
      id: '01990000-0000-7000-8000-000000000001',
      organizationId,
      identityId: '01990000-0000-7000-8000-000000000011',
      contactName: 'Ana Gómez',
      status: 'NEW',
      source: 'paid',
      channel: 'META_LEAD_FORM',
      score: 82,
      ownerUserId: null,
      firstResponseAt: null,
      convertedAt: null,
      closedVia: null,
      consent: consentimientoDeEjemplo(true),
      createdAt: ahora,
      identity: {
        id: '01990000-0000-7000-8000-000000000011',
        email: 'ana.gomez@ejemplo.com',
        phone: '+573001112233',
      },
    },
    {
      id: '01990000-0000-7000-8000-000000000002',
      organizationId,
      identityId: '01990000-0000-7000-8000-000000000012',
      contactName: 'Carlos Ruiz',
      status: 'CONTACTED',
      source: 'organic',
      channel: 'WHATSAPP_CLICK',
      score: 64,
      ownerUserId: '00000000-0000-7000-8000-000000000001',
      firstResponseAt: ahora,
      convertedAt: null,
      closedVia: 'WHATSAPP',
      consent: consentimientoDeEjemplo(true),
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      identity: {
        id: '01990000-0000-7000-8000-000000000012',
        email: 'carlos.ruiz@ejemplo.com',
        phone: '+573002223344',
      },
    },
    {
      id: '01990000-0000-7000-8000-000000000003',
      organizationId,
      identityId: '01990000-0000-7000-8000-000000000013',
      contactName: 'Lucía Márquez',
      status: 'QUALIFIED',
      source: 'referral',
      channel: 'MANUAL',
      score: 91,
      ownerUserId: '00000000-0000-7000-8000-000000000001',
      firstResponseAt: new Date(Date.now() - 120_000).toISOString(),
      convertedAt: null,
      closedVia: null,
      consent: consentimientoDeEjemplo(true),
      createdAt: new Date(Date.now() - 120_000).toISOString(),
      identity: {
        id: '01990000-0000-7000-8000-000000000013',
        email: 'lucia.marquez@ejemplo.com',
        phone: '+573003334455',
      },
    },
  ];
}
