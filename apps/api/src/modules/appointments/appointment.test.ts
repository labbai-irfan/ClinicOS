import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { createTestClinic, authed } from '../../test/helpers';

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
});
