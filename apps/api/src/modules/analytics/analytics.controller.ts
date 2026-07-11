import type { Request, Response } from 'express';
import { ok } from '../../shared/http';
import { UnauthenticatedError } from '../../shared/errors';
import * as service from './analytics.service';
import type { AnalyticsContext } from './analytics.service';

interface RangeQuery {
  from: string;
  to: string;
}

function requireContext(req: Request): AnalyticsContext {
  if (!req.tenant) throw new UnauthenticatedError();
  return { clinicId: req.tenant.clinicId, timezone: req.tenant.timezone };
}

function requireRange(req: Request): RangeQuery {
  return req.query as unknown as RangeQuery;
}

/** GET /analytics/patients — day-by-day new-vs-returning patient breakdown. */
export async function patients(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const { from, to } = requireRange(req);
  const result = await service.getPatientsAnalytics(ctx, from, to);
  ok(res, result);
}

/** GET /analytics/queue — wait-time trend, status distribution, no-show rate. */
export async function queue(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const { from, to } = requireRange(req);
  const result = await service.getQueueAnalytics(ctx, from, to);
  ok(res, result);
}

/** GET /analytics/revenue — daily revenue trend + breakdown by payment method. */
export async function revenue(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const { from, to } = requireRange(req);
  const result = await service.getRevenueAnalytics(ctx, from, to);
  ok(res, result);
}

/** GET /analytics/emergency — case volume trend, priority distribution, time-to-doctor. */
export async function emergency(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const { from, to } = requireRange(req);
  const result = await service.getEmergencyAnalytics(ctx, from, to);
  ok(res, result);
}
