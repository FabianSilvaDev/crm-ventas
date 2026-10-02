import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

import { LeadsController } from './leads.controller.js';
import { InMemoryLeadRepository, LEAD_REPOSITORY, seedLeads } from './leads.repository.js';
import { LeadsService } from './leads.service.js';

function defaultOrganizationId(env: Env): string {
  return env.DEFAULT_ORGANIZATION_ID ?? '0198f000-0000-7000-8000-000000000001';
}

@Module({
  imports: [AuthModule],
  controllers: [LeadsController],
  providers: [
    LeadsService,
    {
      provide: LEAD_REPOSITORY,
      inject: [ENV],
      useFactory: (env: Env) => new InMemoryLeadRepository(seedLeads(defaultOrganizationId(env))),
    },
  ],
})
export class LeadsModule {}
