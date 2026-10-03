import { Module } from '@nestjs/common';

import type { Lead } from '@crm/contracts';

import { AuthModule } from '../auth/auth.module.js';
import { IDENTITIES_DB, LEADS_DB } from '../db/db.module.js';
import type { JsonDb } from '../db/json-db.js';
import type { StoredIdentity } from '../db/types.js';

import { LeadsController } from './leads.controller.js';
import { JsonLeadRepository, LEAD_REPOSITORY } from './leads.repository.js';
import { LeadsService } from './leads.service.js';

@Module({
  imports: [AuthModule],
  controllers: [LeadsController],
  providers: [
    LeadsService,
    {
      provide: LEAD_REPOSITORY,
      inject: [LEADS_DB, IDENTITIES_DB],
      useFactory: (leadsDb: JsonDb<Lead>, identitiesDb: JsonDb<StoredIdentity>) =>
        new JsonLeadRepository(leadsDb, identitiesDb),
    },
  ],
})
export class LeadsModule {}
