import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { LeadsController } from './leads.controller.js';
import { LEAD_REPOSITORY, PrismaLeadRepository } from './leads.repository.js';
import { LeadsService } from './leads.service.js';

@Module({
  imports: [AuthModule],
  controllers: [LeadsController],
  providers: [
    LeadsService,
    {
      provide: LEAD_REPOSITORY,
      useClass: PrismaLeadRepository,
    },
  ],
})
export class LeadsModule {}
