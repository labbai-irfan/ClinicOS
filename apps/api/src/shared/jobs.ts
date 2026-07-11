import { logger } from './logger';

export type JobName =
  | 'appointment-reminder'
  | 'follow-up-reminder'
  | 'prescription-pdf'
  | 'report-generation'
  | 'queue-estimate-recalc'
  | 'notification-retry';

/**
 * Facade over the background job system (BullMQ in apps/worker).
 * Core operations MUST NOT depend on Redis: when no queue connection is available
 * this facade logs and drops the job — the API keeps working (spec §3, ADR-10).
 *
 * Phase 1 ships the facade with the no-op fallback; the worker app registers the
 * real enqueue function at startup when REDIS_URL is configured.
 */
type EnqueueFn = (name: JobName, payload: Record<string, unknown>, delayMs?: number) => Promise<void>;

let enqueueImpl: EnqueueFn | null = null;

export function registerJobBackend(fn: EnqueueFn): void {
  enqueueImpl = fn;
}

export async function enqueueJob(
  name: JobName,
  payload: Record<string, unknown>,
  delayMs?: number,
): Promise<void> {
  if (!enqueueImpl) {
    logger.warn({ job: name }, 'job backend unavailable — job skipped (non-blocking by design)');
    return;
  }
  try {
    await enqueueImpl(name, payload, delayMs);
  } catch (err) {
    logger.error({ err, job: name }, 'failed to enqueue job — continuing without it');
  }
}
