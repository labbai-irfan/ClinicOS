import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import type { AppointmentStatus, QueueStatus } from '@clinicos/types';
import { authed, createTestClinic, type TestClinic } from '../../test/helpers';
import { dayRangeUtc, todayInTimezone } from '../../shared/dates';
import { PatientModel } from '../patients/patient.model';
import { AppointmentModel } from '../appointments/appointment.model';
import { QueueEntryModel } from '../queues/queue-entry.model';
import { EmergencyCaseModel } from '../emergencies/emergency.model';
import { EmergencyEventModel } from '../emergencies/emergency-event.model';
import { InvoiceModel } from '../billing/invoice.model';
import { PaymentModel } from '../billing/payment.model';

// Clinics seeded by createTestClinic() use ClinicModel's default timezone.
const TZ = 'Asia/Kolkata';

let seq = 0;
function uniqueId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}-${Date.now()}`;
}

async function seedPatient(clinic: TestClinic, createdAt: Date) {
  return PatientModel.create({
    organizationId: clinic.organizationId,
    clinicId: clinic.clinicId,
    code: uniqueId('PT'),
    fullName: uniqueId('Patient'),
    gender: 'unknown',
    emergencyContacts: [],
    allergies: [],
    conditions: [],
    currentMedicines: [],
    isTemporary: false,
    createdAt,
  });
}

async function seedAppointment(
  clinic: TestClinic,
  patientId: Types.ObjectId,
  date: string,
  status: AppointmentStatus = 'scheduled',
) {
  const windowStart = new Date();
  return AppointmentModel.create({
    organizationId: clinic.organizationId,
    clinicId: clinic.clinicId,
    branchId: clinic.branchId,
    patientId,
    doctorId: new Types.ObjectId(),
    date,
    windowStart,
    windowEnd: new Date(windowStart.getTime() + 15 * 60_000),
    type: 'new',
    status,
  });
}

async function seedQueueEntry(
  clinic: TestClinic,
  opts: {
    patientId: Types.ObjectId;
    date: string;
    status?: QueueStatus;
    checkedInAt?: Date;
    consultationStartedAt?: Date;
  },
) {
  return QueueEntryModel.create({
    organizationId: clinic.organizationId,
    clinicId: clinic.clinicId,
    branchId: clinic.branchId,
    date: opts.date,
    token: uniqueId('TKN'),
    patientId: opts.patientId,
    source: 'walk_in',
    status: opts.status ?? 'completed',
    checkedInAt: opts.checkedInAt,
    consultationStartedAt: opts.consultationStartedAt,
  });
}

/**
 * Seeds an invoice + one payment directly against the models (bypassing the billing
 * HTTP API). Invoice numbers are clinic-scoped, and `totalPaise`/`paidPaise` are
 * independently controllable so revenue-vs-invoice-total scenarios can be set up
 * precisely and deterministically.
 */
async function seedInvoiceWithPayment(
  clinic: TestClinic,
  opts: { totalPaise: number; paidPaise: number; method: 'cash' | 'upi'; createdAt?: Date },
) {
  const invoice = await InvoiceModel.create({
    organizationId: clinic.organizationId,
    clinicId: clinic.clinicId,
    branchId: clinic.branchId,
    invoiceNumber: uniqueId('INV'),
    patientId: new Types.ObjectId(),
    items: [
      { description: 'Consultation', type: 'consultation', quantity: 1, unitPricePaise: opts.totalPaise, totalPaise: opts.totalPaise },
    ],
    subtotalPaise: opts.totalPaise,
    discountPaise: 0,
    totalPaise: opts.totalPaise,
    paidPaise: opts.paidPaise,
    refundedPaise: 0,
    status: opts.paidPaise >= opts.totalPaise ? 'paid' : opts.paidPaise > 0 ? 'partially_paid' : 'unpaid',
    deferred: false,
  });
  const payment = await PaymentModel.create({
    organizationId: clinic.organizationId,
    clinicId: clinic.clinicId,
    branchId: clinic.branchId,
    invoiceId: invoice._id,
    amountPaise: opts.paidPaise,
    method: opts.method,
    receiptNumber: uniqueId('RCPT'),
    receivedByUserId: clinic.userIds.clinic_owner,
    receivedByName: 'Owner User',
    ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
  });
  return { invoice, payment };
}

/** Applies a refund directly to a seeded payment; `updatedAt` is bumped to "now" by the
 * schema's timestamps middleware, matching how refundPayment() marks the refund event
 * in production (see analytics.service.ts's revenue comment). */
async function refundPaymentDirect(paymentId: Types.ObjectId, amountPaise: number): Promise<void> {
  await PaymentModel.updateOne({ _id: paymentId }, { $set: { refundedAmountPaise: amountPaise } });
}

async function seedEmergencyCase(
  clinic: TestClinic,
  opts: { arrivalAt: Date; priority: 'critical' | 'urgent' | 'standard' | 'unconfirmed' },
) {
  return EmergencyCaseModel.create({
    organizationId: clinic.organizationId,
    clinicId: clinic.clinicId,
    branchId: clinic.branchId,
    caseCode: uniqueId('ER'),
    patientLabel: 'Unidentified',
    gender: 'unknown',
    arrivalAt: opts.arrivalAt,
    arrivalMode: 'walk_in',
    mainConcern: 'Test concern',
    status: 'awaiting_triage',
    priority: opts.priority,
  });
}

async function seedEmergencyEvent(
  clinic: TestClinic,
  emergencyCaseId: Types.ObjectId,
  opts: { action: string; toStatus?: string; createdAt: Date },
) {
  return EmergencyEventModel.create({
    organizationId: clinic.organizationId,
    clinicId: clinic.clinicId,
    branchId: clinic.branchId,
    emergencyCaseId,
    action: opts.action,
    toStatus: opts.toStatus,
    createdAt: opts.createdAt,
  });
}

describe('analytics', () => {
  it('GET /analytics/patients: computes day-by-day new-vs-returning, deduping appointment+queue sources', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.clinic_owner);

    const day0 = '2026-06-20';
    const day1 = '2026-07-01';
    const day2 = '2026-07-02';
    const day0Start = dayRangeUtc(TZ, day0).start;
    const day1Start = dayRangeUtc(TZ, day1).start;

    // New: record created inside [day1, day2].
    const patientNew = await seedPatient(clinic, new Date(day1Start.getTime() + 3600_000));
    // Returning: record created well before the range, with BOTH an appointment AND a
    // queue entry on day1 — must count once, not twice (dedup across sources).
    const patientOldA = await seedPatient(clinic, new Date(day0Start.getTime() + 3600_000));
    await seedAppointment(clinic, patientOldA._id, day1);
    await seedQueueEntry(clinic, { patientId: patientOldA._id, date: day1 });
    // Returning on day2 only.
    const patientOldB = await seedPatient(clinic, new Date(day0Start.getTime() + 3600_000));
    await seedQueueEntry(clinic, { patientId: patientOldB._id, date: day2 });

    const res = await api.get(`/api/v1/analytics/patients?from=${day1}&to=${day2}`);

    expect(res.status).toBe(200);
    expect(res.body.data.daily).toHaveLength(2);
    const [d1, d2] = res.body.data.daily;
    expect(d1.date).toBe(day1);
    expect(d1.newCount).toBe(1);
    expect(d1.returningCount).toBe(1);
    expect(d1.totalCount).toBe(2);
    expect(d2.date).toBe(day2);
    expect(d2.newCount).toBe(0);
    expect(d2.returningCount).toBe(1);
    expect(res.body.data.totals).toEqual({ newCount: 1, returningCount: 2, totalCount: 3 });
    expect(patientNew.code).toBeDefined();
  });

  it('GET /analytics/queue: wait-time trend, status distribution, and no-show rate', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.clinic_owner);

    const day1 = '2026-07-05';
    const day1Start = dayRangeUtc(TZ, day1).start;
    const patientId = new Types.ObjectId();

    await seedQueueEntry(clinic, {
      patientId,
      date: day1,
      status: 'completed',
      checkedInAt: new Date(day1Start.getTime() + 3600_000),
      consultationStartedAt: new Date(day1Start.getTime() + 3600_000 + 10 * 60_000),
    });
    await seedQueueEntry(clinic, {
      patientId,
      date: day1,
      status: 'completed',
      checkedInAt: new Date(day1Start.getTime() + 2 * 3600_000),
      consultationStartedAt: new Date(day1Start.getTime() + 2 * 3600_000 + 20 * 60_000),
    });
    // Still waiting — no consultationStartedAt yet, must be excluded from the wait average.
    await seedQueueEntry(clinic, {
      patientId,
      date: day1,
      status: 'waiting_for_doctor',
      checkedInAt: new Date(day1Start.getTime() + 3 * 3600_000),
    });

    await seedAppointment(clinic, patientId, day1, 'no_show');
    await seedAppointment(clinic, patientId, day1, 'cancelled');
    await seedAppointment(clinic, patientId, day1, 'completed');
    await seedAppointment(clinic, patientId, day1, 'scheduled');

    const res = await api.get(`/api/v1/analytics/queue?from=${day1}&to=${day1}`);

    expect(res.status).toBe(200);
    expect(res.body.data.waitTrend).toEqual([{ date: day1, avgWaitMinutes: 15, sampleSize: 2 }]);
    expect(res.body.data.statusDistribution).toEqual(
      expect.arrayContaining([
        { status: 'completed', count: 2 },
        { status: 'waiting_for_doctor', count: 1 },
      ]),
    );
    // eligible = 4 appointments - 1 cancelled = 3; no-show = 1 → rate = 1/3.
    expect(res.body.data.noShow.eligibleCount).toBe(3);
    expect(res.body.data.noShow.noShowCount).toBe(1);
    expect(res.body.data.noShow.rate).toBeCloseTo(1 / 3, 5);
  });

  it('GET /analytics/revenue: counts payments actually received, never the invoice total', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.clinic_owner);
    const today = todayInTimezone(TZ);

    // A large invoice (110000) is issued, but only a fraction (20000) is actually paid.
    const { invoice } = await seedInvoiceWithPayment(clinic, {
      totalPaise: 110000,
      paidPaise: 20000,
      method: 'cash',
    });
    expect(invoice.totalPaise).toBe(110000);

    const res = await api.get(`/api/v1/analytics/revenue?from=${today}&to=${today}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totals.revenuePaise).toBe(20000);
    expect(res.body.data.totals.revenuePaise).not.toBe(invoice.totalPaise);
    expect(res.body.data.daily[0].revenuePaise).toBe(20000);
    expect(res.body.data.daily[0].grossPaise).toBe(20000);
  });

  it('GET /analytics/revenue: refunds reduce net revenue, broken down by payment method', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.clinic_owner);
    const today = todayInTimezone(TZ);

    const { payment: paymentA } = await seedInvoiceWithPayment(clinic, {
      totalPaise: 50000,
      paidPaise: 50000,
      method: 'cash',
    });
    await refundPaymentDirect(paymentA._id, 15000);

    await seedInvoiceWithPayment(clinic, { totalPaise: 20000, paidPaise: 20000, method: 'upi' });

    const res = await api.get(`/api/v1/analytics/revenue?from=${today}&to=${today}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totals.grossPaise).toBe(70000);
    expect(res.body.data.totals.refundedPaise).toBe(15000);
    expect(res.body.data.totals.revenuePaise).toBe(55000);

    const cash = res.body.data.byMethod.find((m: { method: string }) => m.method === 'cash');
    const upi = res.body.data.byMethod.find((m: { method: string }) => m.method === 'upi');
    expect(cash).toEqual({ method: 'cash', grossPaise: 50000, refundedPaise: 15000, revenuePaise: 35000 });
    expect(upi).toEqual({ method: 'upi', grossPaise: 20000, refundedPaise: 0, revenuePaise: 20000 });
  });

  it('GET /analytics/revenue: buckets a multi-day trend by the local day payments were received', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.clinic_owner);

    const day1 = '2026-07-08';
    const day2 = '2026-07-09';
    const day1Start = dayRangeUtc(TZ, day1).start;
    const day2Start = dayRangeUtc(TZ, day2).start;

    await seedInvoiceWithPayment(clinic, {
      totalPaise: 30000,
      paidPaise: 30000,
      method: 'cash',
      createdAt: new Date(day1Start.getTime() + 3600_000),
    });
    await seedInvoiceWithPayment(clinic, {
      totalPaise: 45000,
      paidPaise: 45000,
      method: 'upi',
      createdAt: new Date(day2Start.getTime() + 2 * 3600_000),
    });

    const res = await api.get(`/api/v1/analytics/revenue?from=${day1}&to=${day2}`);

    expect(res.status).toBe(200);
    expect(res.body.data.daily).toEqual([
      { date: day1, grossPaise: 30000, refundedPaise: 0, revenuePaise: 30000 },
      { date: day2, grossPaise: 45000, refundedPaise: 0, revenuePaise: 45000 },
    ]);
    expect(res.body.data.totals.revenuePaise).toBe(75000);
  });

  it('GET /analytics/emergency: case volume, priority distribution, and average time-to-doctor', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.clinic_owner);

    const day1 = '2026-07-10';
    const day1Start = dayRangeUtc(TZ, day1).start;

    const case1 = await seedEmergencyCase(clinic, {
      arrivalAt: new Date(day1Start.getTime() + 3600_000),
      priority: 'critical',
    });
    await seedEmergencyEvent(clinic, case1._id, { action: 'arrival', toStatus: 'awaiting_triage', createdAt: case1.arrivalAt });
    await seedEmergencyEvent(clinic, case1._id, {
      action: 'doctor_alerted',
      toStatus: 'doctor_alerted',
      createdAt: new Date(case1.arrivalAt.getTime() + 10 * 60_000),
    });

    const case2 = await seedEmergencyCase(clinic, {
      arrivalAt: new Date(day1Start.getTime() + 2 * 3600_000),
      priority: 'urgent',
    });
    await seedEmergencyEvent(clinic, case2._id, { action: 'arrival', toStatus: 'awaiting_triage', createdAt: case2.arrivalAt });
    await seedEmergencyEvent(clinic, case2._id, {
      action: 'doctor_responding',
      toStatus: 'doctor_responding',
      createdAt: new Date(case2.arrivalAt.getTime() + 20 * 60_000),
    });

    // Arrived, but never reached a doctor within this range — must be excluded from the
    // average (not treated as 0), while still counting toward case volume.
    const case3 = await seedEmergencyCase(clinic, {
      arrivalAt: new Date(day1Start.getTime() + 3 * 3600_000),
      priority: 'standard',
    });
    await seedEmergencyEvent(clinic, case3._id, { action: 'arrival', toStatus: 'awaiting_triage', createdAt: case3.arrivalAt });

    const res = await api.get(`/api/v1/analytics/emergency?from=${day1}&to=${day1}`);

    expect(res.status).toBe(200);
    expect(res.body.data.volumeTrend).toEqual([{ date: day1, count: 3 }]);
    expect(res.body.data.priorityDistribution).toEqual(
      expect.arrayContaining([
        { priority: 'critical', count: 1 },
        { priority: 'urgent', count: 1 },
        { priority: 'standard', count: 1 },
      ]),
    );
    // (10 + 20) / 2 = 15 minutes.
    expect(res.body.data.avgTimeToDoctorMinutes).toBe(15);
  });

  it('GET /analytics/emergency: avgTimeToDoctorMinutes is null (not 0) when no case reached a doctor', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.clinic_owner);

    const day1 = '2026-07-15';
    const day1Start = dayRangeUtc(TZ, day1).start;

    const onlyCase = await seedEmergencyCase(clinic, {
      arrivalAt: new Date(day1Start.getTime() + 3600_000),
      priority: 'unconfirmed',
    });
    await seedEmergencyEvent(clinic, onlyCase._id, {
      action: 'arrival',
      toStatus: 'awaiting_triage',
      createdAt: onlyCase.arrivalAt,
    });

    const res = await api.get(`/api/v1/analytics/emergency?from=${day1}&to=${day1}`);

    expect(res.status).toBe(200);
    expect(res.body.data.volumeTrend).toEqual([{ date: day1, count: 1 }]);
    expect(res.body.data.avgTimeToDoctorMinutes).toBeNull();
  });

  it('rejects analytics access for a role without REPORTS_VIEW', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.nurse);
    const today = todayInTimezone(TZ);

    const res = await api.get(`/api/v1/analytics/revenue?from=${today}&to=${today}`);

    expect(res.status).toBe(403);
  });
});
