import { PrismaClient } from '@prisma/client';

import { DEFAULT_TEST_DATABASE_URL } from './test-setup.js';

/**
 * Setup global de Vitest para los tests de integración con MySQL.
 *
 * Cada fichero de test hace su propio `resetDatabase`, pero antes de empezar la suite completa hay
 * que dejar `crm_test` en un estado conocido: vacía. Esto evita que una ejecución anterior
 * interrumpida, un seed manual o datos de desarrollo que hayan quedado en la base de test contaminen
 * los tests.
 */
export default async function globalSetup(): Promise<void> {
  const databaseUrl =
    process.env['TEST_DATABASE_URL'] ?? DEFAULT_TEST_DATABASE_URL;

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    await prisma.$transaction([
      prisma.refreshToken.deleteMany(),
      prisma.auditLog.deleteMany(),
      prisma.outboxEvent.deleteMany(),
      prisma.lead.deleteMany(),
      prisma.identity.deleteMany(),
      prisma.user.deleteMany(),
      prisma.organization.deleteMany(),
    ]);
    await prisma.lead.count();
  } catch (error) {
    console.error('[globalSetup] error al borrar:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
