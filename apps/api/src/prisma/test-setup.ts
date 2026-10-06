import { PrismaClient } from '@prisma/client';

/**
 * URL por defecto para la base de datos de tests.
 *
 * Se usa cuando ni `TEST_DATABASE_URL` ni la URL explícita del test están configuradas. Es
 * deliberadamente **crm_test**, no `DATABASE_URL`: caer a la base de desarrollo en un test es una
 * condición de carrera silenciosa que contamina datos reales.
 */
export const DEFAULT_TEST_DATABASE_URL =
  'mysql://crm:change-me@localhost:3306/crm_test';

/**
 * Helper para tests de integración con MySQL.
 *
 * Crea un cliente Prisma apuntando a `TEST_DATABASE_URL` (o a la URL recibida) y ofrece
 * `resetDatabase` para dejar las tablas vacías antes de cada test.
 */
export function createTestPrisma(url?: string): PrismaClient {
  const databaseUrl =
    url ??
    process.env['TEST_DATABASE_URL'] ??
    DEFAULT_TEST_DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('TEST_DATABASE_URL o una URL explícita debe estar configurado para los tests.');
  }
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

/**
 * Limpia las tablas de la base de datos de test en orden inverso a las foreign keys.
 *
 * No usa `TRUNCATE` porque MySQL requiere desactivar las foreign key checks; en su lugar borra filas
 * con `deleteMany`, que respeta las restricciones de integridad referencial.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.refreshToken.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.outboxEvent.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.identity.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
  ]);
}
