import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  firstResponseRequestSchema,
  leadCreateSchema,
  leadListQuerySchema,
  leadUpdateSchema,
  Permission,
} from '@crm/contracts';
import type {
  FirstResponseRequest,
  LeadCreate,
  LeadListQuery,
  LeadUpdate,
} from '@crm/contracts';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermission } from '../auth/require-permission.decorator.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

import { LeadsService } from './leads.service.js';

/**
 * Controller REST de leads (`docs/api.md` §9.2).
 *
 * Todas las rutas exigen el token de desarrollo y el permiso correspondiente. Hoy no se implementan
 * ETag/If-Match ni idempotencia: son capas que se añaden cuando la persistencia sea real.
 */
@Controller('leads')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeadsController {
  constructor(
    private readonly service: LeadsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  @RequirePermission(Permission.READ_CUSTOMER_DATA)
  async list(@Query({ schema: leadListQuerySchema }) query: LeadListQuery) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermission(Permission.READ_CUSTOMER_DATA)
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(Permission.WRITE_CUSTOMER_DATA)
  async create(
    @Body({ schema: leadCreateSchema }) body: LeadCreate,
    @Res({ passthrough: true }) response: Response,
  ) {
    const organizationId =
      this.env.DEFAULT_ORGANIZATION_ID ?? '0198f000-0000-7000-8000-000000000001';
    const lead = await this.service.create(body, organizationId);
    response.location(`/api/v1/leads/${lead.id}`);
    return lead;
  }

  @Patch(':id')
  @RequirePermission(Permission.WRITE_CUSTOMER_DATA)
  async update(@Param('id') id: string, @Body({ schema: leadUpdateSchema }) body: LeadUpdate) {
    return this.service.update(id, body);
  }

  @Post(':id/convert')
  @HttpCode(200)
  @RequirePermission(Permission.WRITE_CUSTOMER_DATA)
  async convert(@Param('id') id: string) {
    return this.service.convert(id);
  }

  @Post(':id/first-response')
  @HttpCode(200)
  @RequirePermission(Permission.WRITE_CUSTOMER_DATA)
  async firstResponse(
    @Param('id') id: string,
    @Body({ schema: firstResponseRequestSchema }) body: FirstResponseRequest,
  ) {
    return this.service.firstResponse(id, body);
  }
}
