import { DynamicModule, Inject, Injectable, Module, OnModuleInit } from '@nestjs/common';
import { isAbsolute, join } from 'node:path';

import type { Lead } from '@crm/contracts';

import { ConfigModule } from '../config/config.module.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

import { JsonDb } from './json-db.js';
import { seedIfEmpty } from './seed.js';
import type { StoredIdentity, StoredOrganization, StoredUser } from './types.js';

export const LEADS_DB = Symbol('crm:leads-db');
export const IDENTITIES_DB = Symbol('crm:identities-db');
export const USERS_DB = Symbol('crm:users-db');
export const ORGANIZATIONS_DB = Symbol('crm:organizations-db');

@Injectable()
class SeedService implements OnModuleInit {
  constructor(
    @Inject(LEADS_DB) private readonly leadsDb: JsonDb<Lead>,
    @Inject(IDENTITIES_DB) private readonly identitiesDb: JsonDb<StoredIdentity>,
    @Inject(USERS_DB) private readonly usersDb: JsonDb<StoredUser>,
    @Inject(ORGANIZATIONS_DB) private readonly organizationsDb: JsonDb<StoredOrganization>,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    await seedIfEmpty(this.env, {
      leadsDb: this.leadsDb,
      identitiesDb: this.identitiesDb,
      usersDb: this.usersDb,
      organizationsDb: this.organizationsDb,
    });
  }
}

@Module({})
export class DbModule {
  static forRoot(env: Env): DynamicModule {
    const basePath = env.DB_PATH ?? 'apps/api/db';
    const resolved = isAbsolute(basePath) ? basePath : join(process.cwd(), basePath);

    const fileFor = (name: string): string => join(resolved, `${name}.json`);

    return {
      module: DbModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        {
          provide: LEADS_DB,
          useValue: new JsonDb<Lead>(fileFor('leads')),
        },
        {
          provide: IDENTITIES_DB,
          useValue: new JsonDb<StoredIdentity>(fileFor('identities')),
        },
        {
          provide: USERS_DB,
          useValue: new JsonDb<StoredUser>(fileFor('users')),
        },
        {
          provide: ORGANIZATIONS_DB,
          useValue: new JsonDb<StoredOrganization>(fileFor('organizations')),
        },
        SeedService,
      ],
      exports: [LEADS_DB, IDENTITIES_DB, USERS_DB, ORGANIZATIONS_DB],
    };
  }
}
