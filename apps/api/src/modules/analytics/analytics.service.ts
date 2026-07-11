import { Types } from 'mongoose';
import type { EmergencyPriority, PaymentMethod, QueueStatus } from '@clinicos/types';
import { ValidationError } from '../../shared/errors';
import { dayRangeUtc } from '../../shared/dates';
import { PatientModel } from '../patients/patient.model';
import { AppointmentModel } from '../appointments/appointment.model';
import { QueueEntryModel } from '../queues/queue-entry.model';
// Revenue is computed from PaymentModel only — never InvoiceModel — per the spec's
// explicit "payments received, not invoice totals" formula, so InvoiceModel is
// deliberately not imported here.
import { PaymentModel } from '../billing/payment.model';
import { EmergencyCaseModel } from '../emergencies/emergency.model';
import { EmergencyEventModel } from '../emergencies/emergency-event.model';

/**
 * Every analytics endpoint is a clinic-wide report over a local calendar-date range
 * (spec §40), not a single-branch live view — scoped by clinicId only, mirroring
 * billing.service's dailyClosing rather than the branch-scoped live dashboard.
 */
export interface AnalyticsContext {
  clinicId: Types.ObjectId;
  timezone: string;
}

function assertValidRange(from: string, to: string): void {
  if (from > to) {
    throw new ValidationError([{ field: 'to', message: '"to" must not be before "from".' }]);
  }
}

/** Inclusive list of local calendar-date labels (YYYY-MM-DD) between from and to. */
function enumerateLocalDates(from: string, to: string): string[] {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  const end = Date.UTC(ty, tm - 1, td);
  const dates: string[] = [];
  let cursor = Date.UTC(fy, fm - 1, fd);
  // Pure calendar-label arithmetic in a UTC pseudo-clock — only Y/M/D are read back out,
  // so no real timezone is applied here (the actual local-day boundaries used to filter
  // documents come from dayRangeUtc/the string `date` fields below).
  let guard = 0;
  while (cursor <= end && guard < 400) {
    const d = new Date(cursor);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
    cursor += 24 * 3600 * 1000;
    guard += 1;
  }
  if (guard >= 400) {
    throw new ValidationError([{ field: 'to', message: 'Date range cannot exceed 366 days.' }]);
  }
  return dates;
}

/* ------------------------------------------------------------------------------------ *
 * GET /analytics/patients — day-by-day new-vs-returning breakdown
 * ------------------------------------------------------------------------------------ */

export interface PatientsAnalyticsDaily {
  date: string;
  newCount: number;
  returningCount: number;
  totalCount: number;
}

export interface PatientsAnalyticsResult {
  from: string;
  to: string;
  daily: PatientsAnalyticsDaily[];
  totals: { newCount: number; returningCount: number; totalCount: number };
}

interface PatientDayPair {
  date: string;
  patientId: Types.ObjectId;
}

/**
 * (date, patientId) pairs from `model` (Appointment or QueueEntry) within [from, to],
 * restricted — via $lookup against the patients collection — to patients whose record
 * was created strictly before `rangeStart`, i.e. "returning" per the spec's exact wording
 * ("an appointment or queue entry exists for a patient created before the range start").
 */
async function returningPairs(
  model: typeof AppointmentModel | typeof QueueEntryModel,
  clinicId: Types.ObjectId,
  from: string,
  to: string,
  rangeStart: Date,
): Promise<PatientDayPair[]> {
  const rows = await model.aggregate<{ date: string; patientId: Types.ObjectId }>([
    { $match: { clinicId, deletedAt: null, date: { $gte: from, $lte: to } } },
    { $group: { _id: { date: '$date', patientId: '$patientId' } } },
    {
      $lookup: {
        from: 'patients',
        let: { pid: '$_id.patientId' },
        pipeline: [
          {
            $match: {
              $expr: { $and: [{ $eq: ['$_id', '$$pid'] }, { $lt: ['$createdAt', rangeStart] }] },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: 'existingPatient',
      },
    },
    { $match: { existingPatient: { $ne: [] } } },
    { $project: { _id: 0, date: '$_id.date', patientId: '$_id.patientId' } },
  ]);
  return rows;
}

/**
 * "New" = the patient record was created within [from, to] — patients are created at
 * intake (spec §9), so record-creation date effectively IS the first-visit date.
 * "Returning" = an appointment or queue entry falls within [from, to] for a patient whose
 * record predates the range start (computed precisely via $lookup, not inferred).
 */
export async function getPatientsAnalytics(
  ctx: AnalyticsContext,
  from: string,
  to: string,
): Promise<PatientsAnalyticsResult> {
  assertValidRange(from, to);
  const dates = enumerateLocalDates(from, to);
  const { start: rangeStart } = dayRangeUtc(ctx.timezone, from);
  const { end: rangeEndTo } = dayRangeUtc(ctx.timezone, to);

  const byDate = new Map<string, PatientsAnalyticsDaily>(
    dates.map((date) => [date, { date, newCount: 0, returningCount: 0, totalCount: 0 }]),
  );

  const newAgg = await PatientModel.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        clinicId: ctx.clinicId,
        deletedAt: null,
        createdAt: { $gte: rangeStart, $lt: rangeEndTo },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: ctx.timezone } },
        count: { $sum: 1 },
      },
    },
  ]);
  for (const row of newAgg) {
    const bucket = byDate.get(row._id);
    if (bucket) bucket.newCount = row.count;
  }

  const [apptPairs, queuePairs] = await Promise.all([
    returningPairs(AppointmentModel, ctx.clinicId, from, to, rangeStart),
    returningPairs(QueueEntryModel, ctx.clinicId, from, to, rangeStart),
  ]);

  const returningByDate = new Map<string, Set<string>>();
  for (const pair of [...apptPairs, ...queuePairs]) {
    const set = returningByDate.get(pair.date) ?? new Set<string>();
    set.add(pair.patientId.toString());
    returningByDate.set(pair.date, set);
  }
  for (const [date, set] of returningByDate) {
    const bucket = byDate.get(date);
    if (bucket) bucket.returningCount = set.size;
  }

  const daily = dates.map((date) => {
    const bucket = byDate.get(date);
    if (!bucket) throw new Error(`unreachable: missing bucket for ${date}`);
    bucket.totalCount = bucket.newCount + bucket.returningCount;
    return bucket;
  });

  const totals = daily.reduce(
    (acc, d) => ({
      newCount: acc.newCount + d.newCount,
      returningCount: acc.returningCount + d.returningCount,
      totalCount: acc.totalCount + d.totalCount,
    }),
    { newCount: 0, returningCount: 0, totalCount: 0 },
  );

  return { from, to, daily, totals };
}

/* ------------------------------------------------------------------------------------ *
 * GET /analytics/queue — wait-time trend, status distribution, no-show rate
 * ------------------------------------------------------------------------------------ */

export interface QueueWaitDaily {
  date: string;
  avgWaitMinutes: number | null;
  sampleSize: number;
}

export interface QueueStatusCount {
  status: QueueStatus;
  count: number;
}

export interface QueueAnalyticsResult {
  from: string;
  to: string;
  waitTrend: QueueWaitDaily[];
  statusDistribution: QueueStatusCount[];
  noShow: { noShowCount: number; eligibleCount: number; rate: number | null };
}

export async function getQueueAnalytics(
  ctx: AnalyticsContext,
  from: string,
  to: string,
): Promise<QueueAnalyticsResult> {
  assertValidRange(from, to);
  const dates = enumerateLocalDates(from, to);

  // QueueEntry.date is already the clinic-local YYYY-MM-DD the entry belongs to (minted
  // at check-in time from the same timezone) — a direct string match, no UTC math needed.
  const waitAgg = await QueueEntryModel.aggregate<{ _id: string; avgWaitMinutes: number; sampleSize: number }>([
    {
      $match: {
        clinicId: ctx.clinicId,
        deletedAt: null,
        date: { $gte: from, $lte: to },
        checkedInAt: { $ne: null },
        consultationStartedAt: { $ne: null },
      },
    },
    {
      $project: {
        date: 1,
        waitMinutes: { $divide: [{ $subtract: ['$consultationStartedAt', '$checkedInAt'] }, 60000] },
      },
    },
    { $group: { _id: '$date', avgWaitMinutes: { $avg: '$waitMinutes' }, sampleSize: { $sum: 1 } } },
  ]);
  const waitByDate = new Map(waitAgg.map((r) => [r._id, r]));
  const waitTrend: QueueWaitDaily[] = dates.map((date) => {
    const row = waitByDate.get(date);
    return {
      date,
      avgWaitMinutes: row ? Math.round(row.avgWaitMinutes * 10) / 10 : null,
      sampleSize: row?.sampleSize ?? 0,
    };
  });

  const statusAgg = await QueueEntryModel.aggregate<{ _id: QueueStatus; count: number }>([
    { $match: { clinicId: ctx.clinicId, deletedAt: null, date: { $gte: from, $lte: to } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const statusDistribution: QueueStatusCount[] = statusAgg.map((r) => ({ status: r._id, count: r.count }));

  // No-show rate = no-show appointments / eligible scheduled appointments in range.
  // "Eligible" excludes appointments withdrawn from the schedule ahead of time
  // ('cancelled' / 'rescheduled' — terminal exits reachable only via an explicit
  // reschedule/cancel action per APPOINTMENT_TRANSITIONS, never a missed-visit outcome).
  // Every other terminal/non-terminal status was still "on the books" for its slot and so
  // counts as eligible to have been attended or missed.
  const noShowAgg = await AppointmentModel.aggregate<{ eligibleCount: number; noShowCount: number }>([
    { $match: { clinicId: ctx.clinicId, deletedAt: null, date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: null,
        eligibleCount: { $sum: { $cond: [{ $in: ['$status', ['cancelled', 'rescheduled']] }, 0, 1] } },
        noShowCount: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
      },
    },
  ]);
  const noShowRow = noShowAgg[0] ?? { eligibleCount: 0, noShowCount: 0 };
  const rate = noShowRow.eligibleCount > 0 ? noShowRow.noShowCount / noShowRow.eligibleCount : null;

  return {
    from,
    to,
    waitTrend,
    statusDistribution,
    noShow: { noShowCount: noShowRow.noShowCount, eligibleCount: noShowRow.eligibleCount, rate },
  };
}

/* ------------------------------------------------------------------------------------ *
 * GET /analytics/revenue — daily revenue trend + breakdown by payment method
 * ------------------------------------------------------------------------------------ */

export interface RevenueDaily {
  date: string;
  grossPaise: number;
  refundedPaise: number;
  revenuePaise: number;
}

export interface RevenueByMethod {
  method: PaymentMethod;
  grossPaise: number;
  refundedPaise: number;
  revenuePaise: number;
}

export interface RevenueAnalyticsResult {
  from: string;
  to: string;
  daily: RevenueDaily[];
  byMethod: RevenueByMethod[];
  totals: { grossPaise: number; refundedPaise: number; revenuePaise: number };
}

/**
 * Revenue = payments actually received minus refunds — NEVER invoice totals (an invoice
 * can be issued, discounted, or left partially paid without a rupee changing hands).
 *
 * SIMPLIFICATION: Payment documents carry no dedicated `refundedAt` timestamp — only a
 * cumulative `refundedAmountPaise` on the payment itself. The only mutation path for a
 * payment after creation is refundPayment() (billing.service.ts), so `updatedAt`
 * reliably marks "the last time this payment's refund state changed" and is used as the
 * refund event's date bucket (same approach as dashboard.service's revenueToday).
 * Multiple partial refunds on one payment collapse onto the most recent refund's date —
 * an acceptable simplification given the current data model.
 */
export async function getRevenueAnalytics(
  ctx: AnalyticsContext,
  from: string,
  to: string,
): Promise<RevenueAnalyticsResult> {
  assertValidRange(from, to);
  const dates = enumerateLocalDates(from, to);
  const { start: rangeStart } = dayRangeUtc(ctx.timezone, from);
  const { end: rangeEnd } = dayRangeUtc(ctx.timezone, to);

  const [grossAgg, refundAgg, grossByMethodAgg, refundByMethodAgg] = await Promise.all([
    PaymentModel.aggregate<{ _id: string; grossPaise: number }>([
      { $match: { clinicId: ctx.clinicId, deletedAt: null, createdAt: { $gte: rangeStart, $lt: rangeEnd } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: ctx.timezone } },
          grossPaise: { $sum: '$amountPaise' },
        },
      },
    ]),
    PaymentModel.aggregate<{ _id: string; refundedPaise: number }>([
      {
        $match: {
          clinicId: ctx.clinicId,
          deletedAt: null,
          refundedAmountPaise: { $gt: 0 },
          updatedAt: { $gte: rangeStart, $lt: rangeEnd },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt', timezone: ctx.timezone } },
          refundedPaise: { $sum: '$refundedAmountPaise' },
        },
      },
    ]),
    PaymentModel.aggregate<{ _id: PaymentMethod; grossPaise: number }>([
      { $match: { clinicId: ctx.clinicId, deletedAt: null, createdAt: { $gte: rangeStart, $lt: rangeEnd } } },
      { $group: { _id: '$method', grossPaise: { $sum: '$amountPaise' } } },
    ]),
    PaymentModel.aggregate<{ _id: PaymentMethod; refundedPaise: number }>([
      {
        $match: {
          clinicId: ctx.clinicId,
          deletedAt: null,
          refundedAmountPaise: { $gt: 0 },
          updatedAt: { $gte: rangeStart, $lt: rangeEnd },
        },
      },
      { $group: { _id: '$method', refundedPaise: { $sum: '$refundedAmountPaise' } } },
    ]),
  ]);

  const grossByDate = new Map(grossAgg.map((r) => [r._id, r.grossPaise]));
  const refundByDate = new Map(refundAgg.map((r) => [r._id, r.refundedPaise]));
  const daily: RevenueDaily[] = dates.map((date) => {
    const grossPaise = grossByDate.get(date) ?? 0;
    const refundedPaise = refundByDate.get(date) ?? 0;
    return { date, grossPaise, refundedPaise, revenuePaise: grossPaise - refundedPaise };
  });

  const grossMethodMap = new Map(grossByMethodAgg.map((r) => [r._id, r.grossPaise]));
  const refundMethodMap = new Map(refundByMethodAgg.map((r) => [r._id, r.refundedPaise]));
  const methods = new Set<PaymentMethod>([...grossMethodMap.keys(), ...refundMethodMap.keys()]);
  const byMethod: RevenueByMethod[] = Array.from(methods)
    .sort()
    .map((method) => {
      const grossPaise = grossMethodMap.get(method) ?? 0;
      const refundedPaise = refundMethodMap.get(method) ?? 0;
      return { method, grossPaise, refundedPaise, revenuePaise: grossPaise - refundedPaise };
    });

  const totals = daily.reduce(
    (acc, d) => ({
      grossPaise: acc.grossPaise + d.grossPaise,
      refundedPaise: acc.refundedPaise + d.refundedPaise,
      revenuePaise: acc.revenuePaise + d.revenuePaise,
    }),
    { grossPaise: 0, refundedPaise: 0, revenuePaise: 0 },
  );

  return { from, to, daily, byMethod, totals };
}

/* ------------------------------------------------------------------------------------ *
 * GET /analytics/emergency — case volume trend, priority distribution, time-to-doctor
 * ------------------------------------------------------------------------------------ */

export interface EmergencyVolumeDaily {
  date: string;
  count: number;
}

export interface EmergencyPriorityCount {
  priority: EmergencyPriority;
  count: number;
}

export interface EmergencyAnalyticsResult {
  from: string;
  to: string;
  volumeTrend: EmergencyVolumeDaily[];
  priorityDistribution: EmergencyPriorityCount[];
  avgTimeToDoctorMinutes: number | null;
}

/**
 * Average minutes from arrival to the first doctor-alerted/doctor-responding transition,
 * per case, averaged across cases in range.
 *
 * SIMPLIFICATION (spec §40 — return null rather than a wrong number): a case is only
 * included if its event stream has BOTH an 'arrival' event AND a later event whose
 * `toStatus` is 'doctor_alerted' or 'doctor_responding' (both are recorded, whether the
 * doctor was auto-alerted via assignEmergency() or via an explicit transition — see
 * emergency.service.ts). Cases that never reached a doctor within the queried range are
 * excluded from the average rather than counted as 0 or infinite. Returns null (not 0 or
 * NaN) when no case in range has a computable time-to-doctor.
 */
async function computeAvgTimeToDoctor(
  clinicId: Types.ObjectId,
  caseIds: Types.ObjectId[],
): Promise<number | null> {
  if (caseIds.length === 0) return null;

  const [arrivalAgg, doctorAgg] = await Promise.all([
    EmergencyEventModel.aggregate<{ _id: Types.ObjectId; at: Date }>([
      { $match: { clinicId, emergencyCaseId: { $in: caseIds }, action: 'arrival' } },
      { $group: { _id: '$emergencyCaseId', at: { $min: '$createdAt' } } },
    ]),
    EmergencyEventModel.aggregate<{ _id: Types.ObjectId; at: Date }>([
      {
        $match: {
          clinicId,
          emergencyCaseId: { $in: caseIds },
          toStatus: { $in: ['doctor_alerted', 'doctor_responding'] },
        },
      },
      { $group: { _id: '$emergencyCaseId', at: { $min: '$createdAt' } } },
    ]),
  ]);

  const arrivalByCase = new Map(arrivalAgg.map((r) => [r._id.toString(), r.at]));
  const diffs: number[] = [];
  for (const row of doctorAgg) {
    const arrivalAt = arrivalByCase.get(row._id.toString());
    if (!arrivalAt) continue;
    const diffMinutes = (row.at.getTime() - arrivalAt.getTime()) / 60000;
    if (diffMinutes >= 0) diffs.push(diffMinutes);
  }

  if (diffs.length === 0) return null;
  const avg = diffs.reduce((sum, v) => sum + v, 0) / diffs.length;
  return Math.round(avg * 10) / 10;
}

export async function getEmergencyAnalytics(
  ctx: AnalyticsContext,
  from: string,
  to: string,
): Promise<EmergencyAnalyticsResult> {
  assertValidRange(from, to);
  const dates = enumerateLocalDates(from, to);
  const { start: rangeStart } = dayRangeUtc(ctx.timezone, from);
  const { end: rangeEnd } = dayRangeUtc(ctx.timezone, to);

  const volumeAgg = await EmergencyCaseModel.aggregate<{ _id: string; count: number; caseIds: Types.ObjectId[] }>([
    { $match: { clinicId: ctx.clinicId, deletedAt: null, arrivalAt: { $gte: rangeStart, $lt: rangeEnd } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$arrivalAt', timezone: ctx.timezone } },
        count: { $sum: 1 },
        caseIds: { $push: '$_id' },
      },
    },
  ]);
  const volumeByDate = new Map(volumeAgg.map((r) => [r._id, r.count]));
  const volumeTrend: EmergencyVolumeDaily[] = dates.map((date) => ({ date, count: volumeByDate.get(date) ?? 0 }));
  const caseIds = volumeAgg.flatMap((r) => r.caseIds);

  const priorityAgg = await EmergencyCaseModel.aggregate<{ _id: EmergencyPriority; count: number }>([
    { $match: { clinicId: ctx.clinicId, deletedAt: null, arrivalAt: { $gte: rangeStart, $lt: rangeEnd } } },
    { $group: { _id: '$priority', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const priorityDistribution: EmergencyPriorityCount[] = priorityAgg.map((r) => ({
    priority: r._id,
    count: r.count,
  }));

  const avgTimeToDoctorMinutes = await computeAvgTimeToDoctor(ctx.clinicId, caseIds);

  return { from, to, volumeTrend, priorityDistribution, avgTimeToDoctorMinutes };
}
