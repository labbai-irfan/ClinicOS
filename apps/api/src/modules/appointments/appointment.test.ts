import { describe, expect, it, afterEach } from 'vitest';
import { Types } from 'mongoose';
import request from 'supertest';
import { createTestClinic, authed } from '../../test/helpers';
import { registerJobBackend, resetJobBackend, type JobName, type EnqueueOptions } from '../../shared/jobs';
import { env } from '../../config/env';

function newPatientId(): string {
  return new Types.ObjectId().toString();
}

describe('appointments module', () => {
  it('creates an appointment', async () => {
    const clinic = await createTestClinic();
    const client = authed(clinic.app, clinic.tokens.receptionist);

    const res = await client.post('/api/v1/appointments').send({
      patientId: newPatientId(),
      doctorId: clinic.userIds.doctor.toString(),
      date: '2026-08-10',
      windowStart: '10:00',
      windowEnd: '10:20',
      type: 'new',
      reason: 'Fever and cough',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('scheduled');
    expect(res.body.data.date).toBe('2026-08-10');
    expect(res.body.data.doctorId).toBe(clinic.userIds.doctor.toString());
    expect(res.body.data.windowStart).toBeTruthy();
    expect(res.body.data.recommendedArrival).toBeTruthy();
    // recommendedArrival must be exactly 10 minutes before windowStart.
    const windowStart = new Date(res.body.data.windowStart).getTime();
    const recommendedArrival = new Date(res.body.data.recommendedArrival).getTime();
    expect(windowStart - recommendedArrival).toBe(10 * 60_000);
  });

  it('rejects a double-booking for the same doctor/date/window without override', async () => {
    const clinic = await createTestClinic();
    const client = authed(clinic.app, clinic.tokens.receptionist);
    const doctorId = clinic.userIds.doctor.toString();
    const body = {
      patientId: newPatientId(),
      doctorId,
      date: '2026-08-11',
      windowStart: '09:00',
      windowEnd: '09:20',
      type: 'new' as const,
    };

    const first = await client.post('/api/v1/appointments').send(body);
    expect(first.status).toBe(201);

    const second = await client.post('/api/v1/appointments').send({ ...body, patientId: newPatientId() });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DOUBLE_BOOKING');
  });

  it('honors the doctor schedule maxPerWindow instead of a fixed default (matches available-slots)', async () => {
    const clinic = await createTestClinic();
    const admin = authed(clinic.app, clinic.tokens.clinic_admin);
    const receptionist = authed(clinic.app, clinic.tokens.receptionist);
    const doctorId = clinic.userIds.doctor.toString();

    await admin.post('/api/v1/schedules').send({
      doctorId,
      branchId: clinic.branchId.toString(),
      weekly: [{ day: 'monday', sessions: [{ start: '09:00', end: '10:00' }] }],
      slotMinutes: 20,
      bufferMinutes: 10,
      maxPerWindow: 2,
      walkInCapacityPerDay: 30,
    });

    const body = {
      doctorId,
      date: '2026-08-10', // Monday
      windowStart: '09:00',
      windowEnd: '09:20',
      type: 'new' as const,
    };

    // available-slots would report capacity:2 for this window — booking up to that
    // capacity must succeed, not be rejected on the first overlap like before.
    const first = await receptionist
      .post('/api/v1/appointments')
      .send({ ...body, patientId: newPatientId() });
    expect(first.status).toBe(201);

    const second = await receptionist
      .post('/api/v1/appointments')
      .send({ ...body, patientId: newPatientId() });
    expect(second.status).toBe(201);

    // The third booking exceeds maxPerWindow=2 and is correctly rejected.
    const third = await receptionist
      .post('/api/v1/appointments')
      .send({ ...body, patientId: newPatientId() });
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe('DOUBLE_BOOKING');

    const slots = await receptionist.get(
      `/api/v1/schedules/available-slots?doctorId=${doctorId}&date=2026-08-10`,
    );
    expect(slots.body.data[0]).toMatchObject({ capacity: 2, bookedCount: 2, available: false });
  });

  it('blocks a doctor from being double-booked across two different branches', async () => {
    const clinic = await createTestClinic();
    const owner = authed(clinic.app, clinic.tokens.clinic_owner);
    const receptionist = authed(clinic.app, clinic.tokens.receptionist);
    const doctorId = clinic.userIds.doctor.toString();

    const branchB = await owner.post('/api/v1/branches').send({ name: 'Branch B' });
    const branchBId = branchB.body.data.id as string;

    // Grant the receptionist access to both branches so they can switch context.
    const staffList = await owner.get('/api/v1/staff?roleKey=receptionist');
    const receptionistStaffId = staffList.body.data[0].id as string;
    await owner
      .patch(`/api/v1/staff/${receptionistStaffId}`)
      .send({ branchIds: [clinic.branchId.toString(), branchBId] });

    const bookAtBranch = (branchId: string, patientId: string) =>
      request(clinic.app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${clinic.tokens.receptionist}`)
        .set('x-branch-id', branchId)
        .send({
          patientId,
          doctorId,
          date: '2026-08-20',
          windowStart: '09:00',
          windowEnd: '09:20',
          type: 'new',
        });

    const atBranchA = await bookAtBranch(clinic.branchId.toString(), newPatientId());
    expect(atBranchA.status).toBe(201);

    // Same doctor, same time, a different branch — must never be allowed regardless
    // of that branch's own capacity configuration.
    const atBranchB = await bookAtBranch(branchBId, newPatientId());
    expect(atBranchB.status).toBe(409);
    expect(atBranchB.body.error.code).toBe('DOUBLE_BOOKING');
  });

  it('allows a double-booking when overrideCapacity is set and the actor has APPOINTMENT_OVERRIDE', async () => {
    const clinic = await createTestClinic();
    const receptionist = authed(clinic.app, clinic.tokens.receptionist);
    const admin = authed(clinic.app, clinic.tokens.clinic_admin);
    const doctorId = clinic.userIds.doctor.toString();
    const body = {
      patientId: newPatientId(),
      doctorId,
      date: '2026-08-12',
      windowStart: '11:00',
      windowEnd: '11:20',
      type: 'new' as const,
    };

    const first = await receptionist.post('/api/v1/appointments').send(body);
    expect(first.status).toBe(201);

    // Same slot, no override → rejected even for a permitted admin.
    const rejected = await admin.post('/api/v1/appointments').send({ ...body, patientId: newPatientId() });
    expect(rejected.status).toBe(409);

    // Same slot, admin holds APPOINTMENT_OVERRIDE and sets overrideCapacity → allowed.
    const overridden = await admin
      .post('/api/v1/appointments')
      .send({ ...body, patientId: newPatientId(), overrideCapacity: true });
    expect(overridden.status).toBe(201);
  });

  it('lists appointments filtered by date', async () => {
    const clinic = await createTestClinic();
    const client = authed(clinic.app, clinic.tokens.receptionist);
    const doctorId = clinic.userIds.doctor.toString();

    await client.post('/api/v1/appointments').send({
      patientId: newPatientId(),
      doctorId,
      date: '2026-08-13',
      windowStart: '09:00',
      windowEnd: '09:20',
      type: 'new',
    });
    await client.post('/api/v1/appointments').send({
      patientId: newPatientId(),
      doctorId,
      date: '2026-08-14',
      windowStart: '09:00',
      windowEnd: '09:20',
      type: 'new',
    });

    const res = await client.get('/api/v1/appointments?date=2026-08-13');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].date).toBe('2026-08-13');
    expect(res.body.meta.total).toBe(1);
  });

  it('reschedules an appointment and keeps status unchanged', async () => {
    const clinic = await createTestClinic();
    const client = authed(clinic.app, clinic.tokens.receptionist);

    const created = await client.post('/api/v1/appointments').send({
      patientId: newPatientId(),
      doctorId: clinic.userIds.doctor.toString(),
      date: '2026-08-15',
      windowStart: '09:00',
      windowEnd: '09:20',
      type: 'new',
    });
    const id = created.body.data.id as string;

    const res = await client.patch(`/api/v1/appointments/${id}/reschedule`).send({
      date: '2026-08-16',
      windowStart: '14:00',
      windowEnd: '14:20',
      reason: 'Patient requested a later slot',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.date).toBe('2026-08-16');
    expect(res.body.data.status).toBe('scheduled');
  });

  it('transitions status on the happy path', async () => {
    const clinic = await createTestClinic();
    const receptionist = authed(clinic.app, clinic.tokens.receptionist);
    // The base /status route only requires APPOINTMENT_READ or APPOINTMENT_CREATE —
    // a doctor (read-only on appointments) should be able to move it forward.
    const doctor = authed(clinic.app, clinic.tokens.doctor);

    const created = await receptionist.post('/api/v1/appointments').send({
      patientId: newPatientId(),
      doctorId: clinic.userIds.doctor.toString(),
      date: '2026-08-17',
      windowStart: '09:00',
      windowEnd: '09:20',
      type: 'new',
    });
    const id = created.body.data.id as string;

    const res = await doctor.patch(`/api/v1/appointments/${id}/status`).send({ status: 'confirmed' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('confirmed');
  });

  it('rejects an invalid status transition', async () => {
    const clinic = await createTestClinic();
    const client = authed(clinic.app, clinic.tokens.receptionist);

    const created = await client.post('/api/v1/appointments').send({
      patientId: newPatientId(),
      doctorId: clinic.userIds.doctor.toString(),
      date: '2026-08-18',
      windowStart: '09:00',
      windowEnd: '09:20',
      type: 'new',
    });
    const id = created.body.data.id as string;

    // scheduled → completed is not an allowed transition (must go through checked_in).
    const res = await client.patch(`/api/v1/appointments/${id}/status`).send({ status: 'completed' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('requires a reason to cancel', async () => {
    const clinic = await createTestClinic();
    const client = authed(clinic.app, clinic.tokens.receptionist);

    const created = await client.post('/api/v1/appointments').send({
      patientId: newPatientId(),
      doctorId: clinic.userIds.doctor.toString(),
      date: '2026-08-19',
      windowStart: '09:00',
      windowEnd: '09:20',
      type: 'new',
    });
    const id = created.body.data.id as string;

    const withoutReason = await client.patch(`/api/v1/appointments/${id}/status`).send({ status: 'cancelled' });
    expect(withoutReason.status).toBe(400);

    const withReason = await client
      .patch(`/api/v1/appointments/${id}/status`)
      .send({ status: 'cancelled', reason: 'Patient no longer needs the visit' });
    expect(withReason.status).toBe(200);
    expect(withReason.body.data.status).toBe('cancelled');
  });

  describe('appointment reminder scheduling', () => {
    interface Enqueued {
      name: JobName;
      payload: Record<string, unknown>;
      options?: EnqueueOptions;
    }

    function fakeJobBackend() {
      const enqueued: Enqueued[] = [];
      const cancelled: string[] = [];
      registerJobBackend(
        async (name, payload, options) => {
          enqueued.push({ name, payload, options });
        },
        async (jobId) => {
          cancelled.push(jobId);
        },
      );
      return { enqueued, cancelled };
    }

    afterEach(() => {
      resetJobBackend();
    });

    it('schedules an appointment-reminder job for windowStart minus APPOINTMENT_REMINDER_HOURS_BEFORE', async () => {
      const { enqueued } = fakeJobBackend();
      const clinic = await createTestClinic();
      const client = authed(clinic.app, clinic.tokens.receptionist);

      const res = await client.post('/api/v1/appointments').send({
        patientId: newPatientId(),
        doctorId: clinic.userIds.doctor.toString(),
        date: '2026-09-01',
        windowStart: '10:00',
        windowEnd: '10:20',
        type: 'new',
      });
      expect(res.status).toBe(201);
      const appointmentId = res.body.data.id as string;
      const windowStart = new Date(res.body.data.windowStart).getTime();

      const reminderCalls = enqueued.filter((e) => e.name === 'appointment-reminder');
      expect(reminderCalls).toHaveLength(1);
      const [call] = reminderCalls;
      if (!call) throw new Error('unreachable — length asserted above');
      expect(call.payload).toEqual({ appointmentId });
      expect(call.options?.jobId).toBe(`appointment-reminder-${appointmentId}`);

      const expectedDelay = windowStart - env.APPOINTMENT_REMINDER_HOURS_BEFORE * 3_600_000 - Date.now();
      // Tolerate the few ms of real time that elapse between the assertion above and here.
      expect(call.options?.delayMs).toBeGreaterThan(expectedDelay - 5_000);
      expect(call.options?.delayMs).toBeLessThan(expectedDelay + 5_000);
    });

    it('re-schedules the reminder to the new time on reschedule', async () => {
      const { enqueued, cancelled } = fakeJobBackend();
      const clinic = await createTestClinic();
      const client = authed(clinic.app, clinic.tokens.receptionist);

      const created = await client.post('/api/v1/appointments').send({
        patientId: newPatientId(),
        doctorId: clinic.userIds.doctor.toString(),
        date: '2026-09-02',
        windowStart: '09:00',
        windowEnd: '09:20',
        type: 'new',
      });
      const id = created.body.data.id as string;
      const jobId = `appointment-reminder-${id}`;
      enqueued.length = 0; // drop the create-time enqueue captured above

      const rescheduled = await client.patch(`/api/v1/appointments/${id}/reschedule`).send({
        date: '2026-09-03',
        windowStart: '14:00',
        windowEnd: '14:20',
        reason: 'Patient asked to move it',
      });
      expect(rescheduled.status).toBe(200);

      // The old job is explicitly cancelled before the new one is enqueued, so a stale
      // reminder for the original time can never fire alongside the new one.
      expect(cancelled).toContain(jobId);
      const reminderCalls = enqueued.filter((e) => e.name === 'appointment-reminder');
      expect(reminderCalls).toHaveLength(1);
      const [call] = reminderCalls;
      if (!call) throw new Error('unreachable — length asserted above');
      expect(call.options?.jobId).toBe(jobId);
      const newWindowStart = new Date(rescheduled.body.data.windowStart).getTime();
      const delayMs = call.options?.delayMs;
      expect(delayMs).toBeGreaterThan(0);
      expect(newWindowStart - env.APPOINTMENT_REMINDER_HOURS_BEFORE * 3_600_000 - Date.now()).toBeCloseTo(
        delayMs!,
        -3,
      );
    });

    it('cancels the pending reminder when the appointment is cancelled', async () => {
      const { cancelled } = fakeJobBackend();
      const clinic = await createTestClinic();
      const client = authed(clinic.app, clinic.tokens.receptionist);

      const created = await client.post('/api/v1/appointments').send({
        patientId: newPatientId(),
        doctorId: clinic.userIds.doctor.toString(),
        date: '2026-09-04',
        windowStart: '09:00',
        windowEnd: '09:20',
        type: 'new',
      });
      const id = created.body.data.id as string;

      const res = await client
        .patch(`/api/v1/appointments/${id}/status`)
        .send({ status: 'cancelled', reason: 'No longer needed' });
      expect(res.status).toBe(200);

      expect(cancelled).toContain(`appointment-reminder-${id}`);
    });

    it('does not schedule a reminder for a slot less than the reminder window away', async () => {
      const { enqueued } = fakeJobBackend();
      const clinic = await createTestClinic();
      const client = authed(clinic.app, clinic.tokens.receptionist);

      // "Now" expressed as the clinic's local (Asia/Kolkata) wall-clock date/time, a few
      // minutes out — well inside the default 3-hour reminder window, so no reminder
      // should be scheduled at all. Must use Kolkata's wall clock specifically (not the
      // test runner host's local time), since createAppointment interprets date/windowStart
      // as clinic-local via localDateTimeToUtc(tenant.timezone, ...).
      function kolkataParts(when: Date) {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).formatToParts(when);
        const get = (type: string) => parts.find((p) => p.type === type)!.value;
        return { date: `${get('year')}-${get('month')}-${get('day')}`, hh: get('hour'), mm: get('minute') };
      }
      const soon = kolkataParts(new Date(Date.now() + 10 * 60_000));
      const endSoon = kolkataParts(new Date(Date.now() + 30 * 60_000));

      const res = await client.post('/api/v1/appointments').send({
        patientId: newPatientId(),
        doctorId: clinic.userIds.doctor.toString(),
        date: soon.date,
        windowStart: `${soon.hh}:${soon.mm}`,
        windowEnd: `${endSoon.hh}:${endSoon.mm}`,
        type: 'new',
      });
      expect(res.status).toBe(201);

      expect(enqueued.filter((e) => e.name === 'appointment-reminder')).toHaveLength(0);
    });
  });
});
