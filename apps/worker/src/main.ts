import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

/**
 * Worker de fondo del CRM.
 *
 * Fase 1: solo el esqueleto con BullMQ + Redis. El único job programado es
 * `refresh-token-cleanup`, que hoy solo se registra en logs. En el siguiente hito se conectará a
 * Prisma para borrar refresh tokens expirados y revocados de forma periódica.
 */

const REDIS_URL = process.env['REDIS_URL'];

if (REDIS_URL === undefined || REDIS_URL === '') {
  throw new Error('REDIS_URL no está configurada. El worker no puede arrancar sin Redis.');
}

const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const cleanupQueue = new Queue('refresh-token-cleanup', { connection: redisConnection });

const cleanupWorker = new Worker(
  'refresh-token-cleanup',
  async (job) => {
    // TODO: conectar a Prisma y borrar refresh_tokens donde expiresAt < NOW() o revokedAt IS NOT NULL.
    console.log(`[worker] Job ${job.id} ejecutado en ${new Date().toISOString()}`);
    return { cleaned: 0 };
  },
  { connection: redisConnection },
);

async function schedule(): Promise<void> {
  // Una vez al día. En desarrollo se puede forzar con un job manual desde Redis Insight / BullMQ UI.
  await cleanupQueue.add(
    'cleanup-expired',
    {},
    {
      repeat: { pattern: '0 3 * * *' },
      jobId: 'refresh-token-cleanup-daily',
    },
  );
}

function shutdown(): void {
  console.log('[worker] Cerrando...');
  void cleanupWorker.close();
  void cleanupQueue.close();
  void redisConnection.quit();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

void schedule();

console.log('[worker] Arrancado y escuchando jobs de refresh-token-cleanup.');
