import type { Request } from 'express';
import { Types, type FilterQuery } from 'mongoose';
import type { z } from 'zod';
import {
  ERROR_CODES,
  PERMISSIONS,
  canTransitionAppointment,
  type AppointmentDto,
} from '@clinicos/types';
import {
  appointmentListQuery,
  appointmentStatusSchema,
  createAppointmentSchema,
  rescheduleAppointmentSchema,
} from '@clinicos/validation';
import { localDateTimeToUtc } from '../../shared/dates';
import { tenantFilter } from '../../middleware/tenant';
import type { Pagination } from '../../shared/pagination';
import { audit } from '../../shared/audit';
import { ConflictError, InvalidTransitionError, NotFoundError, UnauthenticatedError, ValidationError } from '../../shared/errors';
import { AppointmentModel, type AppointmentDoc } from './appointment.model';

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type AppointmentStatusInput = z.infer<typeof appointmentStatusSchema>;
export type AppointmentListFilters = z.infer<typeof appointmentListQuery>;

/**
 * Reasonable default per-slot capacity used when a doctor-schedule lookup for the
 * exact slot is not conveniently available. A future schedule.service can replace
 * this with a per-doctor configured value (spec §13).
 */
const DEFAULT_SLOT_CAPACITY = 4;

/** Statuses that no longer occupy a doctor's calendar for capacity purposes. */
const INACTIVE_STATUSES = new Set(['cancelled', 'no_show']);

/** Minutes before windowStart a patient should be told to arrive by. */
const RECOMMENDED_ARRIVAL_MINUTES = 10;

const STATUSES_REQUIRING_REASON = new Set(['cancelled', 'no_show']);

function toDto(doc: AppointmentDoc): AppointmentDto {
  const recommendedArrival = new Date(doc.windowStart.getTime() - RECOMMENDED_ARRIVAL_MINUTES * 60_000);
  return {
    id: doc._id.toString(),
    branchId: doc.branchId ? doc.branchId.toString() : '',
    patientId: doc.patientId.toString(),
    doctorId: doc.doctorId.toString(),
    date: doc.date,
    windowStart: doc.windowStart.toISOString(),
    windowEnd: doc.windowEnd.toISOString(),
    recommendedArrival: recommendedArrival.toISOString(),
    type: doc.type,
    reason: doc.reason,
    status: doc.status,
    internalNotes: doc.internalNotes,
    patientNotes: doc.patientNotes,
    createdAt: doc.createdAt.toISOString(),
  };
}

function requireTenant(req: Request): NonNullable<Request['tenant']> {
  if (!req.tenant) throw new UnauthenticatedError();
  return req.tenant;
}

interface CapacityCheckInput {
  doctorId: string;
  date: string;
  windowStart: Date;
  windowEnd: Date;
  overrideCapacity?: boolean;
  excludeId?: Types.ObjectId;
}

/**
 * Double-booking guard (spec §13): rejects when either (a) the exact doctor/date/
 * windowStart slot has reached the default capacity, or (b) the requested window
 * genuinely overlaps another active appointment for the same doctor. Overridable
 * only when the caller passed overrideCapacity AND holds APPOINTMENT_OVERRIDE —
 * checked here (not via authorize()) because the permission is conditional, not
 * required for every create/reschedule call.
 */
async function assertNoDoubleBooking(req: Request, input: CapacityCheckInput): Promise<void> {
  const tenant = requireTenant(req);
  const doctorId = new Types.ObjectId(input.doctorId);

  const baseFilter: FilterQuery<AppointmentDoc> = {
    clinicId: tenant.clinicId,
    branchId: tenant.branchId,
    doctorId,
    date: input.date,
    status: { $nin: [...INACTIVE_STATUSES] },
    deletedAt: null,
  };
  if (input.excludeId) {
    baseFilter._id = { $ne: input.excludeId };
  }

  const [sameSlotCount, overlapping] = await Promise.all([
    AppointmentModel.countDocuments({ ...baseFilter, windowStart: input.windowStart }),
    AppointmentModel.exists({
      ...baseFilter,
      windowStart: { $lt: input.windowEnd },
      windowEnd: { $gt: input.windowStart },
    }),
  ]);

  const isDoubleBooking = sameSlotCount >= DEFAULT_SLOT_CAPACITY || Boolean(overlapping);
  if (!isDoubleBooking) return;

  const canOverride =
    Boolean(input.overrideCapacity) && tenant.permissions.has(PERMISSIONS.APPOINTMENT_OVERRIDE);
  if (canOverride) return;

  throw new ConflictError(
    'This doctor is already fully booked for the selected time slot. Choose another slot or request an override.',
    ERROR_CODES.DOUBLE_BOOKING,
  );
}

export async function createAppointment(
  req: Request,
  input: CreateAppointmentInput,
): Promise<AppointmentDto> {
  const tenant = requireTenant(req);
  const windowStart = localDateTimeToUtc(tenant.timezone, input.date, input.windowStart);
  const windowEnd = localDateTimeToUtc(tenant.timezone, input.date, input.windowEnd);
  if (windowEnd <= windowStart) {
    throw new ValidationError([{ field: 'windowEnd', message: 'windowEnd must be after windowStart.' }]);
  }

  await assertNoDoubleBooking(req, {
    doctorId: input.doctorId,
    date: input.date,
    windowStart,
    windowEnd,
    overrideCapacity: input.overrideCapacity,
  });

  const doc = await AppointmentModel.create({
    organizationId: tenant.organizationId,
    clinicId: tenant.clinicId,
    branchId: tenant.branchId,
    patientId: new Types.ObjectId(input.patientId),
    doctorId: new Types.ObjectId(input.doctorId),
    date: input.date,
    windowStart,
    windowEnd,
    type: input.type,
    reason: input.reason,
    internalNotes: input.internalNotes,
    patientNotes: input.patientNotes,
    status: 'scheduled',
  });

  await audit(req, {
    action: 'appointment.create',
    resource: 'appointment',
    resourceId: doc._id.toString(),
    after: { date: doc.date, windowStart: doc.windowStart, windowEnd: doc.windowEnd, doctorId: input.doctorId },
  });

  return toDto(doc);
}

export async function listAppointments(
  req: Request,
  filters: AppointmentListFilters,
  pagination: Pagination,
): Promise<{ items: AppointmentDto[]; total: number }> {
  const filter: FilterQuery<AppointmentDoc> = { ...tenantFilter(req) };

  if (filters.date) {
    filter.date = filters.date;
  } else if (filters.from || filters.to) {
    const range: Record<string, string> = {};
    if (filters.from) range.$gte = filters.from;
    if (filters.to) range.$lte = filters.to;
    filter.date = range;
  }
  if (filters.doctorId) filter.doctorId = new Types.ObjectId(filters.doctorId);
  if (filters.patientId) filter.patientId = new Types.ObjectId(filters.patientId);
  if (filters.status) filter.status = filters.status;

  const [docs, total] = await Promise.all([
    AppointmentModel.find(filter)
      .sort({ date: 1, windowStart: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    AppointmentModel.countDocuments(filter),
  ]);

  return { items: docs.map(toDto), total };
}

async function getAppointmentDocOrThrow(req: Request, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Appointment');
  const doc = await AppointmentModel.findOne({ _id: id, ...tenantFilter(req) });
  if (!doc) throw new NotFoundError('Appointment');
  return doc;
}

export async function getAppointment(req: Request, id: string): Promise<AppointmentDto> {
  const doc = await getAppointmentDocOrThrow(req, id);
  return toDto(doc);
}

export async function rescheduleAppointment(
  req: Request,
  id: string,
  input: RescheduleAppointmentInput,
): Promise<AppointmentDto> {
  const tenant = requireTenant(req);
  const doc = await getAppointmentDocOrThrow(req, id);

  const windowStart = localDateTimeToUtc(tenant.timezone, input.date, input.windowStart);
  const windowEnd = localDateTimeToUtc(tenant.timezone, input.date, input.windowEnd);
  if (windowEnd <= windowStart) {
    throw new ValidationError([{ field: 'windowEnd', message: 'windowEnd must be after windowStart.' }]);
  }

  await assertNoDoubleBooking(req, {
    doctorId: doc.doctorId.toString(),
    date: input.date,
    windowStart,
    windowEnd,
    overrideCapacity: input.overrideCapacity,
    excludeId: doc._id,
  });

  const before = { date: doc.date, windowStart: doc.windowStart, windowEnd: doc.windowEnd };

  doc.date = input.date;
  doc.windowStart = windowStart;
  doc.windowEnd = windowEnd;
  // Status is intentionally left as-is (spec §13) — rescheduling does not imply confirmation.
  await doc.save();

  await audit(req, {
    action: 'appointment.reschedule',
    resource: 'appointment',
    resourceId: doc._id.toString(),
    reason: input.reason,
    before,
    after: { date: doc.date, windowStart: doc.windowStart, windowEnd: doc.windowEnd },
  });

  return toDto(doc);
}

export async function changeAppointmentStatus(
  req: Request,
  id: string,
  input: AppointmentStatusInput,
): Promise<AppointmentDto> {
  const doc = await getAppointmentDocOrThrow(req, id);
  const from = doc.status;
  const to = input.status;

  if (!canTransitionAppointment(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
  if (STATUSES_REQUIRING_REASON.has(to) && !input.reason) {
    throw new ValidationError([{ field: 'reason', message: 'A reason is required for this status change.' }]);
  }

  doc.status = to;
  await doc.save();

  await audit(req, {
    action: 'appointment.status_change',
    resource: 'appointment',
    resourceId: doc._id.toString(),
    reason: input.reason,
    before: { status: from },
    after: { status: to },
  });

  return toDto(doc);
}
