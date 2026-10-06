import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { ReadinessIndicator } from './readiness.js';

/**
 * Sonda de readiness para la base de datos MySQL vía Prisma.
 *
 * Ejecuta `SELECT 1` de la forma más barata posible (`queryRaw`). Un fallo de conexión aquí
 * significa que el API no debe recibir tráfico hasta que la base de datos vuelva.
 */
@Injectable()
export class PrismaReadinessIndicator implements ReadinessIndicator {
  readonly name = 'mysql';

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
