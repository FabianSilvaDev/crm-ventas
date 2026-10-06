import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type {
  ClosedVia,
  Consent,
  IdentitySummary,
  Lead,
  LeadChannel,
  LeadCreate,
  LeadStatus,
  LeadUpdate,
} from '@crm/contracts';

import type { StoredIdentity } from '../db/types.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Puerto de salida del agregado Lead.
 *
 * Es async porque toda persistencia real es asíncrona. Los controladores y servicios esperan las
 * promesas, pero el contrato no cambia cuando se cambie la implementación.
 */
export interface LeadRepository {
  list(options: ListOptions): Promise<LeadListResult>;
  findById(id: string): Promise<Lead | undefined>;
  create(data: CreateLeadInput): Promise<Lead>;
  update(id: string, data: LeadUpdate): Promise<Lead | undefined>;
  convert(id: string): Promise<Lead | undefined>;
  firstResponse(id: string, closedVia?: ClosedVia | null): Promise<Lead | undefined>;
}

export interface CreateLeadInput extends LeadCreate {
  readonly organizationId: string;
  readonly identityId: string;
  readonly contactName: string | null;
  readonly identity: IdentitySummary;
}

export interface ListOptions {
  readonly limit: number;
  readonly cursor?: string;
  readonly status?: LeadStatus;
  readonly channel?: LeadChannel;
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
 * Se conserva para tests unitarios rápidos que no necesitan tocar base de datos.
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
 * Repositorio de leads que persiste en MySQL a través de Prisma.
 */
type LeadWithIdentity = Prisma.LeadGetPayload<{ include: { identity: true } }>;

@Injectable()
export class PrismaLeadRepository implements LeadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: ListOptions): Promise<LeadListResult> {
    const where: { status?: LeadStatus; channel?: LeadChannel } = {};
    if (options.status !== undefined) where.status = options.status;
    if (options.channel !== undefined) where.channel = options.channel;

    let skip = 0;
    if (options.cursor !== undefined) {
      const decoded = decodificarCursor(options.cursor);
      if (decoded !== null) {
        const countBefore = await this.prisma.lead.count({
          where: {
            ...where,
            OR: [
              { createdAt: { gt: new Date(decoded.createdAt) } },
              { createdAt: new Date(decoded.createdAt), id: { gt: decoded.id } },
            ],
          },
        });
        skip = countBefore;
      }
    }

    const rows = await this.prisma.lead.findMany({
      where,
      include: { identity: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: options.limit + 1,
    });

    const hasMore = rows.length > options.limit;
    const items = rows.slice(0, options.limit).map(toLead);
    const last = items[items.length - 1];
    const nextCursor = hasMore && last !== undefined ? codificarCursor(last.createdAt, last.id) : null;

    return { items, hasMore, nextCursor };
  }

  async findById(id: string): Promise<Lead | undefined> {
    const row = await this.prisma.lead.findUnique({ where: { id }, include: { identity: true } });
    return row === null ? undefined : toLead(row);
  }

  async create(data: CreateLeadInput): Promise<Lead> {
    const now = new Date();
    const identityId = data.identityId;

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.identity.create({
        data: {
          id: identityId,
          organizationId: data.organizationId,
          email: data.identity.email,
          phone: data.identity.phone,
          firstSeenAt: now,
          lastSeenAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });

      return tx.lead.create({
        data: {
          id: randomUUID(),
          organizationId: data.organizationId,
          identityId,
          contactName: data.contactName,
          status: data.status,
          source: data.source,
          channel: data.channel,
          score: data.score ?? null,
          ownerUserId: data.ownerUserId ?? null,
          firstResponseAt: null,
          convertedAt: null,
          closedVia: null,
          consentJson: consentToJson(data.consent ?? null),
          createdAt: now,
          updatedAt: now,
        },
        include: { identity: true },
      });
    });

    return toLead(row);
  }

  async update(id: string, data: LeadUpdate): Promise<Lead | undefined> {
    try {
      const row = await this.prisma.lead.update({
        where: { id },
        data: {
          ...(data.status !== undefined && { status: data.status }),
          ...(data.ownerUserId !== undefined && { ownerUserId: data.ownerUserId }),
          ...(data.score !== undefined && { score: data.score }),
          ...(data.closedVia !== undefined && data.closedVia !== null && { closedVia: data.closedVia }),
          ...(data.consent !== undefined && {
            consentJson: consentToJson(data.consent),
          }),
          updatedAt: new Date(),
        },
        include: { identity: true },
      });
      return toLead(row);
    } catch (err) {
      if (isRecordNotFound(err)) {
        return undefined;
      }
      throw err;
    }
  }

  async convert(id: string): Promise<Lead | undefined> {
    const existing = await this.findById(id);
    if (existing === undefined) {
      return undefined;
    }

    try {
      const row = await this.prisma.lead.update({
        where: { id },
        data: {
          status: 'CONVERTED',
          convertedAt: existing.convertedAt === null ? new Date() : new Date(existing.convertedAt),
          updatedAt: new Date(),
        },
        include: { identity: true },
      });
      return toLead(row);
    } catch (err) {
      if (isRecordNotFound(err)) {
        return undefined;
      }
      throw err;
    }
  }

  async firstResponse(id: string, closedVia?: ClosedVia | null): Promise<Lead | undefined> {
    const existing = await this.findById(id);
    if (existing === undefined) {
      return undefined;
    }

    const data: {
      firstResponseAt: Date;
      updatedAt: Date;
      closedVia?: ClosedVia;
    } = {
      firstResponseAt: existing.firstResponseAt === null ? new Date() : new Date(existing.firstResponseAt),
      updatedAt: new Date(),
    };
    if (closedVia !== undefined && closedVia !== null && existing.closedVia === null) {
      data.closedVia = closedVia;
    }

    try {
      const row = await this.prisma.lead.update({
        where: { id },
        data,
        include: { identity: true },
      });
      return toLead(row);
    } catch (err) {
      if (isRecordNotFound(err)) {
        return undefined;
      }
      throw err;
    }
  }
}

function toLead(row: LeadWithIdentity): Lead {
  return {
    id: row.id,
    organizationId: row.organizationId,
    identityId: row.identityId,
    contactName: row.contactName,
    status: row.status,
    source: row.source as Lead['source'],
    channel: row.channel,
    score: row.score,
    ownerUserId: row.ownerUserId,
    firstResponseAt: toIsoNullable(row.firstResponseAt),
    convertedAt: toIsoNullable(row.convertedAt),
    closedVia: row.closedVia,
    consent: row.consentJson === null ? null : (row.consentJson as unknown as Consent),
    createdAt: row.createdAt.toISOString(),
    identity: {
      id: row.identity.id,
      email: row.identity.email,
      phone: row.identity.phone,
    },
  };
}

function consentToJson(consent: Consent | null): Prisma.InputJsonValue | undefined {
  return consent === null ? undefined : (consent as unknown as Prisma.InputJsonValue);
}

function toIsoNullable(value: Date | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toISOString();
}

function isRecordNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2025'
  );
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
