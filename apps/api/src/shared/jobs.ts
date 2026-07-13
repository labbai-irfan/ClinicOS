import { logger } from './logger';

export type JobName =
  | 'appointment-reminder'
  | 'follow-up-reminder'
  | 'prescription-pdf'
  | 'report-generation'
  | 'queue-estimate-recalc'
  | 'notification-retry';

/**
 * Facade over the background job system (BullMQ, producer side lives in
 * shared/job-queue.ts and is registered from server.ts at API startup).
 * Core operations MUST NOT depend on Redis: when no queue connection is available
 * this facade logs and drops the job — the API keeps working (spec §3, ADR-10).
 *
 * Phase 1 ships the facade with the no-op fallback; the worker app registers the
 * real enqueue function at startup when REDIS_URL is configured.
 */
export interface EnqueueOptions {
  /** Deterministic id for dedupe/cancellation, e.g. `appointment-reminder:<appointmentId>`. */
  jobId?: string;
  delayMs?: number;
}

type EnqueueFn = (name: JobName, payload: Record<string, unknown>, options?: EnqueueOptions) => Promise<void>;
type CancelFn = (jobId: string) => Promise<void>;

let enqueueImpl: EnqueueFn | null = null;
let cancelImpl: CancelFn | null = null;

export function registerJobBackend(enqueue: EnqueueFn, cancel: CancelFn): void {
  enqueueImpl = enqueue;
  cancelImpl = cancel;
}

/** Test-only: restores the no-op fallback so tests don't leak a registered backend into each other. */
export function resetJobBackend(): void {
  enqueueImpl = null;
  cancelImpl = null;
}

export async function enqueueJob(
  name: JobName,
  payload: Record<string, unknown>,
  options?: EnqueueOptions,
): Promise<void> {
  if (!enqueueImpl) {
    logger.warn({ job: name }, 'job backend unavailable — job skipped (non-blocking by design)');
    return;
  }
  try {
    await enqueueImpl(name, payload, options);
  } catch (err) {
    logger.error({ err, job: name }, 'failed to enqueue job — continuing without it');
  }
}

/** No-op when no queue backend is registered or the job was never scheduled — cancellation is best-effort. */
export async function cancelJob(jobId: string): Promise<void> {
  if (!cancelImpl) return;
  try {
    await cancelImpl(jobId);
  } catch (err) {
    logger.error({ err, jobId }, 'failed to cancel job — continuing without it');
  }
}
