import { Types } from 'mongoose';
import type { DashboardSummaryDto, PaymentMethod } from '@clinicos/types';
import { QUEUE_ACTIVE_STATUSES } from '@clinicos/types';
import { dayRangeUtc, todayInTimezone } from '../../shared/dates';
import { QueueEntryModel } from '../queues/queue-entry.model';
import { InvoiceModel } from '../billing/invoice.model';
import { PaymentModel } from '../billing/payment.model';
import { EmergencyCaseModel } from '../emergencies/emergency.model';
import { AppointmentModel } from '../appointments/appointment.model';

/** Tenant scoping, resolved by `tenantContext` — never trust clinicId/branchId from input. */
export interface TenantScope {
  clinicId: Types.ObjectId;
  branchId: Types.ObjectId;
  timezone: string;
}

/** `QueueEntryModel.date` already carries the clinic-local YYYY-MM-DD (minted at check-in
 * time from the same timezone), so "today" for queue metrics is a direct string match —
 * no UTC range math needed there. Invoices/payments only carry UTC `createdAt`, so those
 * use `dayRangeUtc` instead (mirrors billing.service's dailyClosing). */

interface QueueStatusCounts {
  waitingForNurse: number;
  readyForDoctor: number;
  inConsultation: number;
  completedToday: number;
  currentlyWaiting: number;
}

const ACTIVE_WAITING_STATUSES = new Set<string>(QUEUE_ACTIVE_STATUSES);

/** One grouped query for every queue-status-derived metric on today's board. */
async function queueStatusCounts(tenant: TenantScope, today: string): Promise<QueueStatusCounts> {
  const rows = await QueueEntryModel.aggregate<{ _id: string; count: number }>([
    { $match: { clinicId: tenant.clinicId, branchId: tenant.branchId, deletedAt: null, date: today } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const byStatus = new Map(rows.map((row) => [row._id, row.count]));
  let currentlyWaiting = 0;
  for (const [status, count] of byStatus) {
    // QUEUE_ACTIVE_STATUSES is already "active minus in_consultation" (spec's definition
    // of currentlyWaiting) — see packages/types/src/state-machines.ts.
    if (ACTIVE_WAITING_STATUSES.has(status)) currentlyWaiting += count;
  }

  return {
    waitingForNurse: byStatus.get('waiting_for_nurse') ?? 0,
    readyForDoctor: byStatus.get('ready_for_doctor') ?? 0,
    inConsultation: byStatus.get('in_consultation') ?? 0,
    completedToday: byStatus.get('completed') ?? 0,
    currentlyWaiting,
  };
}

/** Distinct patients with a queue entry today, regardless of how many entries each has. */
async function patientsTodayCount(tenant: TenantScope, today: string): Promise<number> {
  const rows = await QueueEntryModel.aggregate<{ count: number }>([
    { $match: { clinicId: tenant.clinicId, branchId: tenant.branchId, deletedAt: null, date: today } },
    { $group: { _id: '$patientId' } },
    { $count: 'count' },
  ]);
  return rows[0]?.count ?? 0;
}

/** Average check-in -> consultation-start gap in minutes, or null when no data exists yet
 * (never fabricated as 0). */
async function avgWaitMinutes(tenant: TenantScope, today: string): Promise<number | null> {
  const rows = await QueueEntryModel.aggregate<{ avgMs: number }>([
    {
      $match: {
        clinicId: tenant.clinicId,
        branchId: tenant.branchId,
        deletedAt: null,
        date: today,
        checkedInAt: { $ne: null },
        consultationStartedAt: { $ne: null },
      },
    },
    { $group: { _id: null, avgMs: { $avg: { $subtract: ['$consultationStartedAt', '$checkedInAt'] } } } },
  ]);
  const avgMs = rows[0]?.avgMs;
  if (avgMs === undefined) return null;
  return Math.round(avgMs / 60000);
}

/** Emergency cases still open (any status other than 'closed'); branch-day-independent. */
async function activeEmergenciesCount(tenant: TenantScope): Promise<number> {
  const rows = await EmergencyCaseModel.aggregate<{ count: number }>([
    {
      $match: {
        clinicId: tenant.clinicId,
        branchId: tenant.branchId,
        deletedAt: null,
        status: { $ne: 'closed' },
      },
    },
    { $count: 'count' },
  ]);
  return rows[0]?.count ?? 0;
}

/** Best-effort operational read: follow-up-type appointments scheduled for today. */
async function followUpsDueCount(tenant: TenantScope, today: string): Promise<number> {
  const rows = await AppointmentModel.aggregate<{ count: number }>([
    {
      $match: {
        clinicId: tenant.clinicId,
        branchId: tenant.branchId,
        deletedAt: null,
        type: 'follow_up',
        date: today,
      },
    },
    { $count: 'count' },
  ]);
  return rows[0]?.count ?? 0;
}

interface RevenueResult {
  revenueTodayPaise: number;
  collectedByMethodPaise: Partial<Record<PaymentMethod, number>>;
}

/**
 * Collected revenue is computed from actual Payment documents, never from Invoice
 * totals (an invoice can be issued without being paid) — spec's explicit distinction
 * between "invoiced" and "collected". Refunds reduce today's collected figure whenever
 * the refund itself was processed today, even if the original payment predates today;
 * a payment is only ever mutated by a refund, so `updatedAt` reliably marks that event.
 */
async function revenueToday(tenant: TenantScope, start: Date, end: Date): Promise<RevenueResult> {
  const [receivedRows, refundRows] = await Promise.all([
    PaymentModel.aggregate<{ _id: PaymentMethod; total: number }>([
      {
        $match: {
          clinicId: tenant.clinicId,
          branchId: tenant.branchId,
          deletedAt: null,
          createdAt: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: '$method', total: { $sum: '$amountPaise' } } },
    ]),
    PaymentModel.aggregate<{ total: number }>([
      {
        $match: {
          clinicId: tenant.clinicId,
          branchId: tenant.branchId,
          deletedAt: null,
          refundedAmountPaise: { $gt: 0 },
          updatedAt: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: null, total: { $sum: '$refundedAmountPaise' } } },
    ]),
  ]);

  const collectedByMethodPaise: Partial<Record<PaymentMethod, number>> = {};
  let grossPaise = 0;
  for (const row of receivedRows) {
    collectedByMethodPaise[row._id] = row.total;
    grossPaise += row.total;
  }
  const refundedPaise = refundRows[0]?.total ?? 0;

  return { revenueTodayPaise: grossPaise - refundedPaise, collectedByMethodPaise };
}

/** Outstanding balance (totalPaise - paidPaise) across today's unpaid/partially-paid invoices. */
async function pendingPaymentsToday(tenant: TenantScope, start: Date, end: Date): Promise<number> {
  const rows = await InvoiceModel.aggregate<{ total: number }>([
    {
      $match: {
        clinicId: tenant.clinicId,
        branchId: tenant.branchId,
        deletedAt: null,
        status: { $in: ['unpaid', 'partially_paid'] },
        createdAt: { $gte: start, $lt: end },
      },
    },
    { $group: { _id: null, total: { $sum: { $subtract: ['$totalPaise', '$paidPaise'] } } } },
  ]);
  return rows[0]?.total ?? 0;
}

/** GET /dashboard/summary — every field answers a concrete operational question (spec §10);
 * no metric here is a placeholder or a fabricated average. */
export async function getSummary(tenant: TenantScope): Promise<DashboardSummaryDto> {
  const today = todayInTimezone(tenant.timezone);
  const { start, end } = dayRangeUtc(tenant.timezone, today);

  const [statusCounts, patientsToday, avgWait, activeEmergencies, followUpsDue, revenue, pendingPaymentsPaise] =
    await Promise.all([
      queueStatusCounts(tenant, today),
      patientsTodayCount(tenant, today),
      avgWaitMinutes(tenant, today),
      activeEmergenciesCount(tenant),
      followUpsDueCount(tenant, today),
      revenueToday(tenant, start, end),
      pendingPaymentsToday(tenant, start, end),
    ]);

  return {
    date: today,
    patientsToday,
    currentlyWaiting: statusCounts.currentlyWaiting,
    waitingForNurse: statusCounts.waitingForNurse,
    readyForDoctor: statusCounts.readyForDoctor,
    inConsultation: statusCounts.inConsultation,
    completedToday: statusCounts.completedToday,
    activeEmergencies,
    avgWaitMinutes: avgWait,
    revenueTodayPaise: revenue.revenueTodayPaise,
    pendingPaymentsPaise,
    collectedByMethodPaise: revenue.collectedByMethodPaise,
    followUpsDue,
  };
}
