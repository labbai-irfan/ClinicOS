import { Types, type FilterQuery } from 'mongoose';
import type { Weekday } from '@clinicos/types';
import type {
  AvailableSlotsQuery,
  DoctorLeaveInput,
  DoctorLeaveListQuery,
  DoctorScheduleInput,
  DoctorScheduleQuery,
} from '@clinicos/validation';
import { localDateTimeToUtc } from '../../shared/dates';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { BranchModel } from '../branches/branch.model';
import { MembershipModel } from '../memberships/membership.model';
import { StaffProfileModel } from '../staff/staff.model';
import { AppointmentModel } from '../appointments/appointment.model';
import {
  DoctorLeaveModel,
  DoctorScheduleModel,
  type DoctorLeaveDoc,
  type DoctorScheduleDoc,
} from './schedule.model';

/** Minimal tenant context a service function needs — never trust ids from client input. */
export interface TenantContext {
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  branchId: Types.ObjectId;
  timezone: string;
}

export interface DoctorScheduleDto {
  id: string;
  doctorId: string;
  branchId: string;
  weekly: Array<{ day: Weekday; sessions: Array<{ start: string; end: string }> }>;
  slotMinutes: number;
  bufferMinutes: number;
  maxPerWindow: number;
  walkInCapacityPerDay: number;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorLeaveDto {
  id: string;
  doctorId: string;
  branchId?: string;
  from: string;
  to: string;
  reason?: string;
  createdAt: string;
}

/** Slot grid entry consumed by the booking UI (GET /schedules/available-slots). */
export interface AvailableSlotDto {
  /** Local wall-clock HH:mm (clinic timezone). */
  windowStart: string;
  windowEnd: string;
  capacity: number;
  bookedCount: number;
  available: boolean;
}

/** Statuses that no longer occupy the doctor's calendar — mirrors appointment.service. */
const INACTIVE_STATUSES = ['cancelled', 'no_show'] as const;

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** JS Date#getUTCDay() (0 = Sunday) → canonical Weekday name. */
const JS_DAY_TO_WEEKDAY: readonly Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function toScheduleDto(doc: DoctorScheduleDoc): DoctorScheduleDto {
  return {
    id: doc._id.toString(),
    doctorId: doc.doctorId.toString(),
    branchId: doc.branchId ? doc.branchId.toString() : '',
    weekly: doc.weekly.map((entry) => ({
      day: entry.day,
      sessions: entry.sessions.map((s) => ({ start: s.start, end: s.end })),
    })),
    slotMinutes: doc.slotMinutes,
    bufferMinutes: doc.bufferMinutes,
    maxPerWindow: doc.maxPerWindow,
    walkInCapacityPerDay: doc.walkInCapacityPerDay,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toLeaveDto(doc: DoctorLeaveDoc): DoctorLeaveDto {
  return {
    id: doc._id.toString(),
    doctorId: doc.doctorId.toString(),
    branchId: doc.branchId ? doc.branchId.toString() : undefined,
    from: doc.from,
    to: doc.to,
    reason: doc.reason,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** Verify the branch belongs to the caller's own clinic before using it for scoping. */
async function assertBranchInClinic(tenant: TenantContext, branchId: string): Promise<Types.ObjectId> {
  const branch = await BranchModel.findOne({
    _id: branchId,
    clinicId: tenant.clinicId,
    isActive: true,
  }).lean();
  if (!branch) throw new NotFoundError('Branch');
  return branch._id;
}

/**
 * The frontend refers to a doctor by either the staff-profile id (admin schedules
 * page) or the underlying user id (booking flows, appointment documents). Expand a
 * given id into the equivalent set within this clinic so lookups work with either
 * form. Purely additive — an unknown id simply resolves to itself. Exported so
 * appointment.service can apply the same doctor-identity resolution when checking
 * capacity/double-booking against a schedule.
 */
export async function expandDoctorIds(
  tenant: { clinicId: Types.ObjectId },
  doctorId: string,
): Promise<Types.ObjectId[]> {
  const given = new Types.ObjectId(doctorId);
  const ids: Types.ObjectId[] = [given];
  const profile = await StaffProfileModel.findOne({
    clinicId: tenant.clinicId,
    deletedAt: null,
    $or: [{ _id: given }, { userId: given }],
  })
    .select({ userId: 1 })
    .lean();
  if (profile) {
    for (const candidate of [profile._id, profile.userId]) {
      if (candidate && !ids.some((id) => id.equals(candidate))) ids.push(candidate);
    }
  }
  return ids;
}

/**
 * Canonicalize a client-supplied doctor id to the underlying user id — the stable
 * identity a doctor keeps even if their staff profile is ever recreated. Schedules
 * are always written under this form so the unique {clinicId, branchId, doctorId}
 * index actually prevents duplicates regardless of which id form the caller used.
 */
async function canonicalDoctorId(tenant: TenantContext, doctorId: string): Promise<Types.ObjectId> {
  const given = new Types.ObjectId(doctorId);
  const profile = await StaffProfileModel.findOne({
    clinicId: tenant.clinicId,
    deletedAt: null,
    $or: [{ _id: given }, { userId: given }],
  })
    .select({ userId: 1 })
    .lean();
  return profile ? profile.userId : given;
}

/**
 * Verify `doctorId` actually refers to a staff member of this clinic — checked
 * against MembershipModel (not just StaffProfileModel) because owner accounts
 * created at registration have a membership but no staff profile until one is
 * lazily created (staff.service.getOrCreateProfile).
 */
async function assertDoctorInClinic(tenant: TenantContext, doctorId: string): Promise<void> {
  const given = new Types.ObjectId(doctorId);
  const profile = await StaffProfileModel.findOne({
    clinicId: tenant.clinicId,
    deletedAt: null,
    $or: [{ _id: given }, { userId: given }],
  })
    .select({ userId: 1 })
    .lean();
  const userId = profile ? profile.userId : given;
  const exists = await MembershipModel.exists({ clinicId: tenant.clinicId, userId });
  if (!exists) throw new NotFoundError('Doctor');
}

function toMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
}

function toHHmm(totalMinutes: number): string {
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function assertSessionsValid(weekly: DoctorScheduleInput['weekly']): void {
  for (const entry of weekly) {
    for (const session of entry.sessions) {
      if (toMinutes(session.end) <= toMinutes(session.start)) {
        throw new ValidationError([
          { field: 'weekly', message: `Session end must be after start on ${entry.day}.` },
        ]);
      }
    }
  }
}

/**
 * Upsert the weekly schedule for a doctor+branch. One document per doctor+branch —
 * saving again replaces the weekly template and booking rules in place. A single
 * atomic `findOneAndUpdate(..., { upsert: true })` (backed by the unique
 * {clinicId, branchId, doctorId} index) replaces the previous find-then-create,
 * so a double-click or two concurrent admin tabs can never create two documents
 * for the same doctor+branch — `doctorId` is canonicalized to the user id first so
 * saving via the staff-profile id form can't slip past the index either.
 */
export async function upsertSchedule(
  tenant: TenantContext,
  input: DoctorScheduleInput,
): Promise<{ before: DoctorScheduleDto | null; after: DoctorScheduleDto }> {
  assertSessionsValid(input.weekly);
  const branchId = await assertBranchInClinic(tenant, input.branchId);
  await assertDoctorInClinic(tenant, input.doctorId);
  const doctorId = await canonicalDoctorId(tenant, input.doctorId);

  const before = await DoctorScheduleModel.findOne({
    clinicId: tenant.clinicId,
    branchId,
    doctorId,
    deletedAt: null,
  }).lean();

  const after = await DoctorScheduleModel.findOneAndUpdate(
    { clinicId: tenant.clinicId, branchId, doctorId, deletedAt: null },
    {
      $set: {
        weekly: input.weekly,
        slotMinutes: input.slotMinutes,
        bufferMinutes: input.bufferMinutes,
        maxPerWindow: input.maxPerWindow,
        walkInCapacityPerDay: input.walkInCapacityPerDay,
      },
      $setOnInsert: {
        organizationId: tenant.organizationId,
        clinicId: tenant.clinicId,
        branchId,
        doctorId,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return { before: before ? toScheduleDto(before) : null, after: toScheduleDto(after) };
}

/** One doctor+branch schedule, or null when none has been configured yet. */
export async function getSchedule(
  tenant: TenantContext,
  doctorId: string,
  branchId: string,
): Promise<DoctorScheduleDto | null> {
  const doctorIds = await expandDoctorIds(tenant, doctorId);
  const doc = await DoctorScheduleModel.findOne({
    clinicId: tenant.clinicId,
    branchId: new Types.ObjectId(branchId),
    doctorId: { $in: doctorIds },
    deletedAt: null,
  }).lean();
  return doc ? toScheduleDto(doc) : null;
}

export async function listSchedules(
  tenant: TenantContext,
  filters: DoctorScheduleQuery,
): Promise<DoctorScheduleDto[]> {
  const filter: FilterQuery<DoctorScheduleDoc> = { clinicId: tenant.clinicId, deletedAt: null };
  if (filters.doctorId) filter.doctorId = { $in: await expandDoctorIds(tenant, filters.doctorId) };
  if (filters.branchId) filter.branchId = new Types.ObjectId(filters.branchId);

  const docs = await DoctorScheduleModel.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
  return docs.map(toScheduleDto);
}

export async function listLeaves(
  tenant: TenantContext,
  filters: DoctorLeaveListQuery,
): Promise<DoctorLeaveDto[]> {
  const filter: FilterQuery<DoctorLeaveDoc> = { clinicId: tenant.clinicId, deletedAt: null };
  if (filters.doctorId) filter.doctorId = { $in: await expandDoctorIds(tenant, filters.doctorId) };
  if (filters.branchId) {
    // A leave without a branch is clinic-wide, so it applies to every branch filter.
    filter.$or = [{ branchId: new Types.ObjectId(filters.branchId) }, { branchId: null }];
  }

  const docs = await DoctorLeaveModel.find(filter).sort({ from: 1 }).limit(200).lean();
  return docs.map(toLeaveDto);
}

export async function addLeave(tenant: TenantContext, input: DoctorLeaveInput): Promise<DoctorLeaveDto> {
  const details: Array<{ field: string; message: string }> = [];
  if (!LOCAL_DATE_PATTERN.test(input.from)) details.push({ field: 'from', message: 'Use YYYY-MM-DD.' });
  if (!LOCAL_DATE_PATTERN.test(input.to)) details.push({ field: 'to', message: 'Use YYYY-MM-DD.' });
  if (details.length === 0 && input.to < input.from) {
    details.push({ field: 'to', message: 'End date must be on or after the start date.' });
  }
  if (details.length > 0) throw new ValidationError(details);

  await assertDoctorInClinic(tenant, input.doctorId);
  const branchId = input.branchId ? await assertBranchInClinic(tenant, input.branchId) : undefined;

  const doc = await DoctorLeaveModel.create({
    organizationId: tenant.organizationId,
    clinicId: tenant.clinicId,
    branchId,
    doctorId: new Types.ObjectId(input.doctorId),
    from: input.from,
    to: input.to,
    reason: input.reason,
  });
  return toLeaveDto(doc);
}

/** Soft delete only — the leave stays in the collection with `deletedAt` set. */
export async function removeLeave(tenant: TenantContext, leaveId: string): Promise<DoctorLeaveDto> {
  if (!Types.ObjectId.isValid(leaveId)) throw new NotFoundError('Leave');
  const doc = await DoctorLeaveModel.findOne({
    _id: leaveId,
    clinicId: tenant.clinicId,
    deletedAt: null,
  });
  if (!doc) throw new NotFoundError('Leave');

  doc.deletedAt = new Date();
  await doc.save();
  return toLeaveDto(doc);
}

/**
 * Compute the bookable slot grid for a doctor on one local calendar date (spec §13):
 * expand the day's working sessions into windows of `slotMinutes` separated by
 * `bufferMinutes`; each window offers `maxPerWindow` capacity minus active
 * appointments already overlapping it; leaves covering the date remove the whole day.
 * Consistent with the appointments module: only non-cancelled/no-show, non-deleted
 * appointments consume capacity, and windows are compared as UTC instants derived
 * from the clinic timezone (same conversion appointment booking uses).
 */
export async function getAvailableSlots(
  tenant: TenantContext,
  query: AvailableSlotsQuery,
): Promise<AvailableSlotDto[]> {
  const doctorIds = await expandDoctorIds(tenant, query.doctorId);
  const requestedBranchId = query.branchId
    ? await assertBranchInClinic(tenant, query.branchId)
    : undefined;

  const scheduleFilter: FilterQuery<DoctorScheduleDoc> = {
    clinicId: tenant.clinicId,
    doctorId: { $in: doctorIds },
    deletedAt: null,
  };
  if (requestedBranchId) scheduleFilter.branchId = requestedBranchId;

  const schedules = await DoctorScheduleModel.find(scheduleFilter).lean();
  if (schedules.length === 0) return [];

  // A deactivated branch's schedule must never be offered — branch.service.deactivate
  // doesn't delete the schedule document (history stays intact), so filter it out here
  // rather than falling back to a dead branch's config when no explicit branch is asked for.
  const scheduleBranchIds = [...new Set(schedules.filter((s) => s.branchId).map((s) => s.branchId!.toString()))];
  const activeBranchIds = new Set(
    (
      await BranchModel.find({ clinicId: tenant.clinicId, _id: { $in: scheduleBranchIds }, isActive: true })
        .select({ _id: 1 })
        .lean()
    ).map((b) => b._id.toString()),
  );
  const eligibleSchedules = schedules.filter((s) => !s.branchId || activeBranchIds.has(s.branchId.toString()));
  if (eligibleSchedules.length === 0) return [];

  // Without an explicit branch, prefer the caller's active branch.
  const activeBranch = tenant.branchId.toString();
  const schedule =
    eligibleSchedules.find((s) => s.branchId && s.branchId.toString() === activeBranch) ??
    eligibleSchedules[0];
  if (!schedule) return [];

  const scheduleBranchId = schedule.branchId ?? tenant.branchId;

  // A leave covering this date removes the whole day (clinic-wide or same-branch).
  const leaves = await DoctorLeaveModel.find({
    clinicId: tenant.clinicId,
    doctorId: { $in: doctorIds },
    deletedAt: null,
    from: { $lte: query.date },
    to: { $gte: query.date },
  }).lean();
  const onLeave = leaves.some(
    (leave) => !leave.branchId || leave.branchId.toString() === scheduleBranchId.toString(),
  );
  if (onLeave) return [];

  const weekdayIndex = new Date(`${query.date}T00:00:00Z`).getUTCDay();
  const weekday = JS_DAY_TO_WEEKDAY[weekdayIndex];
  const dayEntry = schedule.weekly.find((entry) => entry.day === weekday);
  if (!dayEntry || dayEntry.sessions.length === 0) return [];

  const slotMinutes = Math.max(schedule.slotMinutes, 5);
  const stepMinutes = slotMinutes + Math.max(schedule.bufferMinutes, 0);
  const capacity = Math.max(schedule.maxPerWindow, 1);

  const appointments = await AppointmentModel.find({
    clinicId: tenant.clinicId,
    branchId: scheduleBranchId,
    doctorId: { $in: doctorIds },
    date: query.date,
    status: { $nin: [...INACTIVE_STATUSES] },
    deletedAt: null,
  })
    .select({ windowStart: 1, windowEnd: 1 })
    .lean();

  const slots: AvailableSlotDto[] = [];
  const sessions = [...dayEntry.sessions].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (const session of sessions) {
    const sessionEnd = toMinutes(session.end);
    for (let start = toMinutes(session.start); start + slotMinutes <= sessionEnd; start += stepMinutes) {
      const windowStart = toHHmm(start);
      const windowEnd = toHHmm(start + slotMinutes);
      const slotStartUtc = localDateTimeToUtc(tenant.timezone, query.date, windowStart);
      const slotEndUtc = localDateTimeToUtc(tenant.timezone, query.date, windowEnd);
      const bookedCount = appointments.filter(
        (appt) => appt.windowStart < slotEndUtc && appt.windowEnd > slotStartUtc,
      ).length;
      slots.push({
        windowStart,
        windowEnd,
        capacity,
        bookedCount,
        available: bookedCount < capacity,
      });
    }
  }

  return slots;
}
