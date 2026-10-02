import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type {
  FirstResponseRequest,
  Lead,
  LeadCreate,
  LeadListQuery,
  LeadListResponse,
  LeadUpdate,
} from '@crm/contracts';

import { AppError } from '../common/app-error.js';

import type { LeadRepository } from './leads.repository.js';
import { LEAD_REPOSITORY } from './leads.repository.js';

/**
 * Servicio de aplicación de leads.
 *
 * No contiene reglas de negocio profundas (fusión de identidades, consentimiento legal, atribución):
 * esas viven en el caso de uso real con base de datos. Aquí solo orquesta el repositorio en memoria
 * y lanza `RESOURCE_NOT_FOUND` cuando corresponde.
 */
@Injectable()
export class LeadsService {
  constructor(@Inject(LEAD_REPOSITORY) private readonly repository: LeadRepository) {}

  list(query: LeadListQuery): LeadListResponse {
    const result = this.repository.list({
      limit: query.limit,
      cursor: query.cursor,
      status: query.status,
      channel: query.channel,
    });

    return {
      items: [...result.items],
      pageInfo: { hasMore: result.hasMore, nextCursor: result.nextCursor },
    };
  }

  findById(id: string): Lead {
    const lead = this.repository.findById(id);
    if (lead === undefined) {
      throw new AppError('RESOURCE_NOT_FOUND', `No existe el lead ${id}.`);
    }
    return lead;
  }

  create(data: LeadCreate, organizationId: string): Lead {
    const identityId = randomUUID();
    const identity = {
      id: identityId,
      email: data.identity.email,
      phone: data.identity.phone,
    };

    return this.repository.create({
      ...data,
      organizationId,
      identityId,
      contactName: null,
      identity,
    });
  }

  update(id: string, data: LeadUpdate): Lead {
    const lead = this.repository.update(id, data);
    if (lead === undefined) {
      throw new AppError('RESOURCE_NOT_FOUND', `No existe el lead ${id}.`);
    }
    return lead;
  }

  convert(id: string): Lead {
    const lead = this.repository.convert(id);
    if (lead === undefined) {
      throw new AppError('RESOURCE_NOT_FOUND', `No existe el lead ${id}.`);
    }
    return lead;
  }

  firstResponse(id: string, data: FirstResponseRequest): Lead {
    const lead = this.repository.firstResponse(id, data.closedVia ?? null);
    if (lead === undefined) {
      throw new AppError('RESOURCE_NOT_FOUND', `No existe el lead ${id}.`);
    }
    return lead;
  }
}
