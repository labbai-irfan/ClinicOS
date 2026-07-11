import { Types } from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { authed, createTestClinic, type TestClinic } from '../../test/helpers';
import { todayInTimezone } from '../../shared/dates';
import { QueueEntryModel } from '../queues/queue-entry.model';
import { InvoiceModel } from '../billing/invoice.model';
import { PaymentModel } from '../billing/payment.model';
import { EmergencyCaseModel } from '../emergencies/emergency.model';
import { AppointmentModel } from '../appointments/appointment.model';

const API = '/api/v1/dashboard/summary';
const TIMEZONE = 'Asia/Kolkata'; // ClinicModel's default timezone (see clinic.model.ts)

let seq = 0;
function unique(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}-${Date.now()}`;
}

function objectId(): Types.ObjectId {
  return new Types.ObjectId();
}

function today(): string {
  return todayInTimezone(TIMEZONE);
}

async function seedQueueEntry(
  clinic: TestClinic,
  overrides: Record<string, unknown> = {},
): Promise<InstanceType<typeof QueueEntryModel>> {
  return QueueEntryModel.create({
    organizationId: clinic.organizationId,
    clinicId: clinic.clinicId,
    branchId: clinic.branchId,
    date: today(),
    token: unique('A'),
    patientId: objectId(),
    source: 'walk_in',
    status: 'checked_in',
    ...overrides,
  });
}

async function seedInvoice(
  clinic: TestClinic,
  overrides: Record<string, unknown> = {},
): Promise<InstanceType<typeof InvoiceModel>> {
  return InvoiceModel.create({
    organizationId: clinic.organizationId,
    clinicId: clinic.clinicId,
    branchId: clinic.branchId,
    invoiceNumber: unique('INV'),
    patientId: objectId(),
    items: [],
    subtotalPaise: 0,
    totalPaise: 0,
    paidPaise: 0,
    refundedPaise: 0,
    status: 'unpaid',
    deferred: false,
    ...overrides,
  });
}

async function seedPayment(
  clinic: TestClinic,
  invoiceId: Types.ObjectId,
  overrides: Record<string, unknown> = {},
): Promise<InstanceType<typeof PaymentModel>> {
  return PaymentModel.create({
    organizationId: clinic.organizationId,
    clinicId: clinic.clinicId,
    branchId: clinic.branchId,
    invoiceId,
    amountPaise: 10000,
    method: 'cash',
    receiptNumber: unique('RCPT'),
    receivedByUserId: clinic.userIds.receptionist,
    receivedByName: 'Receptionist user',
    refunded: false,
    refundedAmountPaise: 0,
    ...overrides,
  });
}

async function seedEmergency(
  clinic: TestClinic,
  overrides: Record<string, unknown> = {},
): Promise<InstanceType<typeof EmergencyCaseModel>> {
  return EmergencyCaseModel.create({
    organizationId: clinic.organizationId,
    clinicId: clinic.clinicId,
    branchId: clinic.branchId,
    caseCode: unique('ER'),
    patientLabel: 'Unidentified',
    gender: 'unknown',
    arrivalAt: new Date(),
    arrivalMode: 'walk_in',
    mainConcern: 'Chest pain',
    status: 'awaiting_triage',
    priority: 'unconfirmed',
    ...overrides,
  });
}

async function seedAppointment(
  clinic: TestClinic,
  overrides: Record<string, unknown> = {},
): Promise<InstanceType<typeof AppointmentModel>> {
  const windowStart = new Date();
  const windowEnd = new Date(windowStart.getTime() + 15 * 60 * 1000);
  return AppointmentModel.create({
    organizationId: clinic.organizationId,
    clinicId: clinic.clinicId,
    branchId: clinic.branchId,
    patientId: objectId(),
    doctorId: clinic.userIds.doctor,
    date: today(),
    windowStart,
    windowEnd,
    type: 'new',
    status: 'scheduled',
    ...overrides,
  });
}

describe('dashboards module', () => {
  it('returns all-zero counts and a null avgWaitMinutes for a brand new clinic', async () => {
    const clinic = await createTestClinic();
    const client = authed(clinic.app, clinic.tokens.receptionist);

    const res = await client.get(API);

    expect(res.status).toBe(200);
    expect(res.body.data.date).toBe(today());
    expect(res.body.data.patientsToday).toBe(0);
    expect(res.body.data.currentlyWaiting).toBe(0);
    expect(res.body.data.waitingForNurse).toBe(0);
    expect(res.body.data.readyForDoctor).toBe(0);
    expect(res.body.data.inConsultation).toBe(0);
    expect(res.body.data.completedToday).toBe(0);
    expect(res.body.data.activeEmergencies).toBe(0);
    // Never fabricated as 0 or NaN — null explicitly means "no completed consultations yet".
    expect(res.body.data.avgWaitMinutes).toBeNull();
    expect(res.body.data.revenueTodayPaise).toBe(0);
    expect(res.body.data.pendingPaymentsPaise).toBe(0);
    expect(res.body.data.collectedByMethodPaise).toEqual({});
    expect(res.body.data.followUpsDue).toBe(0);
  });

  it('rejects an unauthenticated request', async () => {
    const clinic = await createTestClinic();

    const res = await request(clinic.app).get(API);

    expect(res.status).toBe(401);
  });

  it('counts distinct patients today and buckets queue entries by status, including currentlyWaiting', async () => {
    const clinic = await createTestClinic();
    const client = authed(clinic.app, clinic.tokens.receptionist);

    const samePatient = objectId();
    // Two entries for the same patient today — patientsToday must count them once.
    await seedQueueEntry(clinic, { patientId: samePatient, status: 'completed' });
    await seedQueueEntry(clinic, { patientId: samePatient, status: 'waiting_for_nurse' });
    await seedQueueEntry(clinic, { status: 'ready_for_doctor' });
    await seedQueueEntry(clinic, { status: 'in_consultation' });
    await seedQueueEntry(clinic, { status: 'checked_in' });
    // Yesterday's entry must not leak into today's counts.
    await seedQueueEntry(clinic, { status: 'waiting_for_nurse', date: '2020-01-01' });

    const res = await client.get(API);

    expect(res.status).toBe(200);
    expect(res.body.data.patientsToday).toBe(4);
    expect(res.body.data.waitingForNurse).toBe(1);
    expect(res.body.data.readyForDoctor).toBe(1);
    expect(res.body.data.inConsultation).toBe(1);
    expect(res.body.data.completedToday).toBe(1);
    // Active-but-not-in-consultation: waiting_for_nurse + ready_for_doctor + checked_in = 3.
    expect(res.body.data.currentlyWaiting).toBe(3);
  });

  it('computes avgWaitMinutes as the mean of consultationStartedAt - checkedInAt for today', async () => {
    const clinic = await createTestClinic();
    const client = authed(clinic.app, clinic.tokens.receptionist);

    const checkedInA = new Date();
    await seedQueueEntry(clinic, {
      status: 'in_consultation',
      checkedInAt: checkedInA,
      consultationStartedAt: new Date(checkedInA.getTime() + 10 * 60 * 1000),
    });
    const checkedInB = new Date();
    await seedQueueEntry(clinic, {
      status: 'in_consultation',
      checkedInAt: checkedInB,
      consultationStartedAt: new Date(checkedInB.getTime() + 20 * 60 * 1000),
    });
    // Still waiting — no consultationStartedAt yet, must not skew the average.
    await seedQueueEntry(clinic, { status: 'waiting_for_doctor', checkedInAt: new Date() });

    const res = await client.get(API);

    expect(res.status).toBe(200);
    expect(res.body.data.avgWaitMinutes).toBe(15);
  });

  it('computes revenueTodayPaise from actual payments net of same-day refunds, grouped by method', async () => {
    const clinic = await createTestClinic();
    const client = authed(clinic.app, clinic.tokens.receptionist);

    const invoiceA = await seedInvoice(clinic, { totalPaise: 50000, paidPaise: 20000, status: 'partially_paid' });
    await seedPayment(clinic, invoiceA._id, { amountPaise: 20000, method: 'cash', refundedAmountPaise: 5000 });

    const invoiceB = await seedInvoice(clinic, { totalPaise: 15000, paidPaise: 15000, status: 'paid' });
    await seedPayment(clinic, invoiceB._id, { amountPaise: 15000, method: 'upi' });

    const res = await client.get(API);

    expect(res.status).toBe(200);
    // Gross collected today = 20000 + 15000 = 35000; minus a 5000 refund processed today.
    expect(res.body.data.revenueTodayPaise).toBe(30000);
    expect(res.body.data.collectedByMethodPaise.cash).toBe(20000);
    expect(res.body.data.collectedByMethodPaise.upi).toBe(15000);
  });

  it('sums pendingPaymentsPaise across unpaid/partially-paid invoices only, excluding paid ones', async () => {
    const clinic = await createTestClinic();
    const client = authed(clinic.app, clinic.tokens.receptionist);

    await seedInvoice(clinic, { totalPaise: 50000, paidPaise: 20000, status: 'partially_paid' });
    await seedInvoice(clinic, { totalPaise: 30000, paidPaise: 0, status: 'unpaid' });
    // Fully paid — must not contribute to the pending balance.
    await seedInvoice(clinic, { totalPaise: 15000, paidPaise: 15000, status: 'paid' });

    const res = await client.get(API);

    expect(res.status).toBe(200);
    expect(res.body.data.pendingPaymentsPaise).toBe(60000);
  });

  it('counts active (non-closed) emergencies and follow-up appointments due today', async () => {
    const clinic = await createTestClinic();
    const client = authed(clinic.app, clinic.tokens.receptionist);

    await seedEmergency(clinic, { status: 'awaiting_triage' });
    await seedEmergency(clinic, { status: 'under_assessment' });
    await seedEmergency(clinic, { status: 'closed' });

    await seedAppointment(clinic, { type: 'follow_up' });
    await seedAppointment(clinic, { type: 'new' });
    await seedAppointment(clinic, { type: 'follow_up', date: '2099-01-01' });

    const res = await client.get(API);

    expect(res.status).toBe(200);
    expect(res.body.data.activeEmergencies).toBe(2);
    expect(res.body.data.followUpsDue).toBe(1);
  });
});
