import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

/**
 * Módulo global de Prisma.
 *
 * Exporta `PrismaService` a toda la aplicación para que los repositorios lo inyecten sin necesidad
 * de importar este módulo en cada feature module.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
