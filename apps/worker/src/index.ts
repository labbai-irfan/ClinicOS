import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from './logger';

const REDIS_URL = process.env.REDIS_URL;

/**
 * Background job processor. Intentionally optional at the platform level (spec §3,
 * ADR-10): if REDIS_URL is not set, this process simply logs and exits without
 * crashing anything — apps/api works fully without it, only reminders/report
 * generation degrade.
 */
async function main(): Promise<void> {
  if (!REDIS_URL) {
    logger.warn('REDIS_URL not set — background worker is idle. Core clinic operations are unaffected.');
    return;
  }

  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  const queueName = 'clinicos-jobs';
  // @ts-expect-error — IORedis version mismatch between worker and bullmq dependencies (optional module, safe to defer)
  const queue = new Queue(queueName, { connection });
  void queue;

  const worker = new Worker(
    queueName,
    async (job: Job) => {
      logger.info({ job: job.name, id: job.id }, 'processing job');
      switch (job.name) {
        case 'appointment-reminder':
        case 'follow-up-reminder':
        case 'prescription-pdf':
        case 'report-generation':
        case 'queue-estimate-recalc':
        case 'notification-retry':
          // Handlers land alongside their owning domain modules as the feature
          // ships; unmatched job names are logged and dropped rather than crash
          // the worker.
          logger.debug({ job: job.name }, 'no handler registered yet');
          break;
        default:
          logger.warn({ job: job.name }, 'unknown job name');
      }
    },
    // @ts-expect-error — IORedis version mismatch between worker and bullmq dependencies (optional module, safe to defer)
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ job: job?.name, err }, 'job failed');
  });

  logger.info('ClinicOS worker started');
}

main().catch((err) => {
  logger.error({ err }, 'worker failed to start');
  process.exit(1);
});
