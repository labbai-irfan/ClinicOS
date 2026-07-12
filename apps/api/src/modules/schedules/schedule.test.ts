import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { authed, createTestClinic, type TestClinic } from '../../test/helpers';
import { StaffProfileModel } from '../staff/staff.model';
import { DoctorLeaveModel } from './schedule.model';

/** 2026-08-10 is a Monday — matches the `weekly` entry used throughout. */
const MONDAY = '2026-08-10';

function scheduleBody(clinic: TestClinic, overrides: Record<string, unknown> = {}) {
  return {
    doctorId: clinic.userIds.doctor.toString(),
    branchId: clinic.branchId.toString(),
    weekly: [{ day: 'monday', sessions: [{ start: '09:00', end: '10:00' }] }],
    slotMinutes: 20,
    bufferMinutes: 10,
    maxPerWindow: 2,
    walkInCapacityPerDay: 30,
    ...overrides,
  };
}

describe('schedules module', () => {
  it('upserts a weekly schedule per doctor+branch and reads it back', async () => {
    const clinic = await createTestClinic();
    const admin = authed(clinic.app, clinic.tokens.clinic_admin);
    const doctorId = clinic.userIds.doctor.toString();
    const branchId = clinic.branchId.toString();

    const createdRes = await admin.post('/api/v1/schedules').send(scheduleBody(clinic));
    expect(createdRes.status).toBe(200);
    expect(createdRes.body.success).toBe(true);
    expect(createdRes.body.data.doctorId).toBe(doctorId);
    expect(createdRes.body.data.branchId).toBe(branchId);
    expect(createdRes.body.data.slotMinutes).toBe(20);
    expect(createdRes.body.data.maxPerWindow).toBe(2);
    expect(createdRes.body.data.weekly).toEqual([
      { day: 'monday', sessions: [{ start: '09:00', end: '10:00' }] },
    ]);

    const fetched = await admin.get(`/api/v1/schedules?doctorId=${doctorId}&branchId=${branchId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.id).toBe(createdRes.body.data.id);

    // Saving again updates the same document (upsert, not duplicate).
    const updated = await admin
      .post('/api/v1/schedules')
      .send(scheduleBody(clinic, { slotMinutes: 15, bufferMinutes: 5 }));
    expect(updated.status).toBe(200);
    expect(updated.body.data.id).toBe(createdRes.body.data.id);
    expect(updated.body.data.slotMinutes).toBe(15);
  });

  it('returns null for an unconfigured doctor+branch and a list without both filters', async () => {
    const clinic = await createTestClinic();
    const admin = authed(clinic.app, clinic.tokens.clinic_admin);
    const doctorId = clinic.userIds.doctor.toString();
    const branchId = clinic.branchId.toString();

    const empty = await admin.get(`/api/v1/schedules?doctorId=${doctorId}&branchId=${branchId}`);
    expect(empty.status).toBe(200);
    expect(empty.body.data).toBeNull();

    await admin.post('/api/v1/schedules').send(scheduleBody(clinic));
    const list = await admin.get('/api/v1/schedules');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data).toHaveLength(1);
  });

  it('computes available slots from sessions, slot and buffer minutes', async () => {
    const clinic = await createTestClinic();
    const admin = authed(clinic.app, clinic.tokens.clinic_admin);
    await admin.post('/api/v1/schedules').send(scheduleBody(clinic));

    const res = await admin.get(
      `/api/v1/schedules/available-slots?doctorId=${clinic.userIds.doctor.toString()}&date=${MONDAY}`,
    );
    expect(res.status).toBe(200);
    // 09:00–10:00 with 20-minute slots + 10-minute buffer → 09:00 and 09:30 only.
    expect(res.body.data).toEqual([
      { windowStart: '09:00', windowEnd: '09:20', capacity: 2, bookedCount: 0, available: true },
      { windowStart: '09:30', windowEnd: '09:50', capacity: 2, bookedCount: 0, available: true },
    ]);
  });

  it('subtracts booked appointments from slot capacity', async () => {
    const clinic = await createTestClinic();
    const admin = authed(clinic.app, clinic.tokens.clinic_admin);
    const receptionist = authed(clinic.app, clinic.tokens.receptionist);
    await admin.post('/api/v1/schedules').send(scheduleBody(clinic, { maxPerWindow: 1 }));

    const booking = await receptionist.post('/api/v1/appointments').send({
      patientId: new Types.ObjectId().toString(),
      doctorId: clinic.userIds.doctor.toString(),
      date: MONDAY,
      windowStart: '09:00',
      windowEnd: '09:20',
      type: 'new',
    });
    expect(booking.status).toBe(201);

    const res = await receptionist.get(
      `/api/v1/schedules/available-slots?doctorId=${clinic.userIds.doctor.toString()}&date=${MONDAY}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({
      windowStart: '09:00',
      windowEnd: '09:20',
      capacity: 1,
      bookedCount: 1,
      available: false,
    });
    expect(res.body.data[1].available).toBe(true);

    // Cancelled appointments release their capacity.
    await receptionist
      .patch(`/api/v1/appointments/${booking.body.data.id}/status`)
      .send({ status: 'cancelled', reason: 'Patient cancelled' });
    const after = await receptionist.get(
      `/api/v1/schedules/available-slots?doctorId=${clinic.userIds.doctor.toString()}&date=${MONDAY}`,
    );
    expect(after.body.data[0].bookedCount).toBe(0);
    expect(after.body.data[0].available).toBe(true);
  });

  it('returns no slots when the doctor has no schedule, no sessions that day, or is on leave', async () => {
    const clinic = await createTestClinic();
    const admin = authed(clinic.app, clinic.tokens.clinic_admin);
    const doctorId = clinic.userIds.doctor.toString();

    const noSchedule = await admin.get(
      `/api/v1/schedules/available-slots?doctorId=${doctorId}&date=${MONDAY}`,
    );
    expect(noSchedule.status).toBe(200);
    expect(noSchedule.body.data).toEqual([]);

    await admin.post('/api/v1/schedules').send(scheduleBody(clinic));

    // 2026-08-11 is a Tuesday — no weekly entry.
    const offDay = await admin.get(
      `/api/v1/schedules/available-slots?doctorId=${doctorId}&date=2026-08-11`,
    );
    expect(offDay.body.data).toEqual([]);

    await admin.post('/api/v1/schedules/leaves').send({
      doctorId,
      from: '2026-08-09',
      to: '2026-08-11',
      reason: 'Conference',
    });
    const onLeave = await admin.get(
      `/api/v1/schedules/available-slots?doctorId=${doctorId}&date=${MONDAY}`,
    );
    expect(onLeave.body.data).toEqual([]);
  });

  it('resolves a schedule saved under the staff-profile id when queried by user id', async () => {
    const clinic = await createTestClinic();
    const admin = authed(clinic.app, clinic.tokens.clinic_admin);
    const profile = await StaffProfileModel.create({
      organizationId: clinic.organizationId,
      clinicId: clinic.clinicId,
      userId: clinic.userIds.doctor,
      roleKey: 'doctor',
    });

    await admin
      .post('/api/v1/schedules')
      .send(scheduleBody(clinic, { doctorId: profile._id.toString() }));

    const byUserId = await admin.get(
      `/api/v1/schedules/available-slots?doctorId=${clinic.userIds.doctor.toString()}&date=${MONDAY}`,
    );
    expect(byUserId.status).toBe(200);
    expect(byUserId.body.data).toHaveLength(2);
  });

  it('adds, lists, and soft-deletes doctor leaves', async () => {
    const clinic = await createTestClinic();
    const admin = authed(clinic.app, clinic.tokens.clinic_admin);
    const doctorId = clinic.userIds.doctor.toString();

    const createdLeave = await admin.post('/api/v1/schedules/leaves').send({
      doctorId,
      branchId: clinic.branchId.toString(),
      from: '2026-09-01',
      to: '2026-09-03',
      reason: 'Annual leave',
    });
    expect(createdLeave.status).toBe(201);
    expect(createdLeave.body.data.doctorId).toBe(doctorId);
    expect(createdLeave.body.data.from).toBe('2026-09-01');
    expect(createdLeave.body.data.to).toBe('2026-09-03');
    expect(createdLeave.body.data.reason).toBe('Annual leave');
    const leaveId = createdLeave.body.data.id as string;

    const listed = await admin.get(
      `/api/v1/schedules/leaves?doctorId=${doctorId}&branchId=${clinic.branchId.toString()}`,
    );
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].id).toBe(leaveId);

    const removed = await admin.delete(`/api/v1/schedules/leaves/${leaveId}`);
    expect(removed.status).toBe(200);

    const afterDelete = await admin.get(`/api/v1/schedules/leaves?doctorId=${doctorId}`);
    expect(afterDelete.body.data).toHaveLength(0);

    // Soft delete only — the document survives with deletedAt set.
    const raw = await DoctorLeaveModel.findById(leaveId).lean();
    expect(raw).not.toBeNull();
    expect(raw?.deletedAt).toBeInstanceOf(Date);
  });

  it('rejects invalid payloads with 400', async () => {
    const clinic = await createTestClinic();
    const admin = authed(clinic.app, clinic.tokens.clinic_admin);

    const badSchedule = await admin
      .post('/api/v1/schedules')
      .send(scheduleBody(clinic, { doctorId: 'not-an-id' }));
    expect(badSchedule.status).toBe(400);
    expect(badSchedule.body.error.code).toBe('VALIDATION_ERROR');

    const backwardsSession = await admin.post('/api/v1/schedules').send(
      scheduleBody(clinic, {
        weekly: [{ day: 'monday', sessions: [{ start: '10:00', end: '09:00' }] }],
      }),
    );
    expect(backwardsSession.status).toBe(400);

    const backwardsLeave = await admin.post('/api/v1/schedules/leaves').send({
      doctorId: clinic.userIds.doctor.toString(),
      from: '2026-09-05',
      to: '2026-09-01',
    });
    expect(backwardsLeave.status).toBe(400);
  });

  it('forbids schedule mutations for a role without schedule.manage', async () => {
    const clinic = await createTestClinic();
    const admin = authed(clinic.app, clinic.tokens.clinic_admin);
    const receptionist = authed(clinic.app, clinic.tokens.receptionist);
    const doctorId = clinic.userIds.doctor.toString();

    const upsert = await receptionist.post('/api/v1/schedules').send(scheduleBody(clinic));
    expect(upsert.status).toBe(403);

    const addLeave = await receptionist.post('/api/v1/schedules/leaves').send({
      doctorId,
      from: '2026-09-01',
      to: '2026-09-02',
    });
    expect(addLeave.status).toBe(403);

    const seeded = await admin.post('/api/v1/schedules/leaves').send({
      doctorId,
      from: '2026-09-01',
      to: '2026-09-02',
    });
    const removal = await receptionist.delete(`/api/v1/schedules/leaves/${seeded.body.data.id}`);
    expect(removal.status).toBe(403);

    // Reads stay open to authenticated staff (booking needs the slot grid).
    const slots = await receptionist.get(
      `/api/v1/schedules/available-slots?doctorId=${doctorId}&date=${MONDAY}`,
    );
    expect(slots.status).toBe(200);
  });

  it('isolates schedules and leaves between clinics', async () => {
    const clinicA = await createTestClinic('Clinic A');
    const clinicB = await createTestClinic('Clinic B');
    const adminA = authed(clinicA.app, clinicA.tokens.clinic_admin);
    const adminB = authed(clinicB.app, clinicB.tokens.clinic_admin);
    const doctorA = clinicA.userIds.doctor.toString();

    await adminA.post('/api/v1/schedules').send(scheduleBody(clinicA));
    const leave = await adminA.post('/api/v1/schedules/leaves').send({
      doctorId: doctorA,
      from: '2026-09-01',
      to: '2026-09-02',
    });

    const crossSchedule = await adminB.get(
      `/api/v1/schedules?doctorId=${doctorA}&branchId=${clinicA.branchId.toString()}`,
    );
    expect(crossSchedule.status).toBe(200);
    expect(crossSchedule.body.data).toBeNull();

    const crossList = await adminB.get('/api/v1/schedules');
    expect(crossList.body.data).toHaveLength(0);

    const crossLeaves = await adminB.get(`/api/v1/schedules/leaves?doctorId=${doctorA}`);
    expect(crossLeaves.body.data).toHaveLength(0);

    const crossSlots = await adminB.get(
      `/api/v1/schedules/available-slots?doctorId=${doctorA}&date=${MONDAY}`,
    );
    expect(crossSlots.body.data).toEqual([]);

    const crossDelete = await adminB.delete(`/api/v1/schedules/leaves/${leave.body.data.id}`);
    expect(crossDelete.status).toBe(404);
  });
});
