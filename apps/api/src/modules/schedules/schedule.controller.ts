import type { Request, Response } from 'express';
import type {
  AvailableSlotsQuery,
  DoctorLeaveInput,
  DoctorLeaveListQuery,
  DoctorScheduleInput,
  DoctorScheduleQuery,
} from '@clinicos/validation';
import { created, ok } from '../../shared/http';
import { audit } from '../../shared/audit';
import { UnauthenticatedError } from '../../shared/errors';
import * as scheduleService from './schedule.service';

function requireTenant(req: Request): scheduleService.TenantContext {
  if (!req.tenant) throw new UnauthenticatedError();
  return {
    organizationId: req.tenant.organizationId,
    clinicId: req.tenant.clinicId,
    branchId: req.tenant.branchId,
    timezone: req.tenant.timezone,
  };
}

/**
 * GET /schedules — with both doctorId and branchId returns that single schedule
 * (or null when not configured yet, which the admin editor treats as defaults);
 * otherwise returns a filtered list.
 */
export async function getOrList(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const query = req.query as DoctorScheduleQuery;
  if (query.doctorId && query.branchId) {
    ok(res, await scheduleService.getSchedule(tenant, query.doctorId, query.branchId));
    return;
  }
  ok(res, await scheduleService.listSchedules(tenant, query));
}

export async function upsert(req: Request, res: Response): Promise<void> {
  const { before, after } = await scheduleService.upsertSchedule(
    requireTenant(req),
    req.body as DoctorScheduleInput,
  );
  await audit(req, {
    action: 'schedule.upsert',
    resource: 'doctor_schedule',
    resourceId: after.id,
    before: before ?? undefined,
    after,
  });
  ok(res, after);
}

export async function availableSlots(req: Request, res: Response): Promise<void> {
  const slots = await scheduleService.getAvailableSlots(
    requireTenant(req),
    req.query as unknown as AvailableSlotsQuery,
  );
  ok(res, slots);
}

export async function listLeaves(req: Request, res: Response): Promise<void> {
  const leaves = await scheduleService.listLeaves(requireTenant(req), req.query as DoctorLeaveListQuery);
  ok(res, leaves);
}

export async function addLeave(req: Request, res: Response): Promise<void> {
  const leave = await scheduleService.addLeave(requireTenant(req), req.body as DoctorLeaveInput);
  await audit(req, {
    action: 'schedule.leave_add',
    resource: 'doctor_leave',
    resourceId: leave.id,
    after: leave,
  });
  created(res, leave);
}

export async function removeLeave(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const before = await scheduleService.removeLeave(requireTenant(req), id);
  await audit(req, {
    action: 'schedule.leave_remove',
    resource: 'doctor_leave',
    resourceId: before.id,
    before,
  });
  ok(res, { id: before.id });
}
