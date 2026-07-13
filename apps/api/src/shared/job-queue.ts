import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';
import { registerJobBackend, type JobName, type EnqueueOptions } from './jobs';

const QUEUE_NAME = 'clinicos-jobs';

/**
 * Wires the real BullMQ producer into the shared/jobs.ts facade. Call once at API
 * startup (server.ts, alongside initSocket). No-ops when REDIS_URL isn't set — the
 * facade's own fallback (log + drop) then applies to every enqueueJob/cancelJob call,
 * exactly like the rest of the optional-Redis surface (spec §3, ADR-10).
 */
export function initJobQueue(): void {
  if (!env.REDIS_URL) {
    logger.warn('REDIS_URL not set — background jobs (e.g. appointment reminders) will not be scheduled.');
    return;
  }

  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  // @ts-expect-error — IORedis version mismatch between this workspace's ioredis and
  // bullmq's bundled version (same suppression already used in apps/worker/src/index.ts).
  const queue = new Queue(QUEUE_NAME, { connection });

  registerJobBackend(
    async (name: JobName, payload: Record<string, unknown>, options?: EnqueueOptions) => {
      await queue.add(name, payload, {
        jobId: options?.jobId,
        delay: options?.delayMs,
        removeOnComplete: true,
        removeOnFail: true,
      });
    },
    async (jobId: string) => {
      const job = await queue.getJob(jobId);
      if (job) await job.remove();
    },
  );

  logger.info('Job queue producer connected');
}
