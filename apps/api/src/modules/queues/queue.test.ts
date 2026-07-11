import { beforeEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { authed, createTestClinic, type TestClinic } from '../../test/helpers';
import { PatientModel } from '../patients/patient.model';
import * as queueService from './queue.service';

const API = '/api/v1/queues';

function newPatientId(): string {
  return new Types.ObjectId().toString();
}

async function seedPatient(clinic: TestClinic, fullName: string): Promise<string> {
  const patient = await PatientModel.create({
    organizationId: clinic.organizationId,
    clinicId: clinic.clinicId,
    code: 'P-' + new Types.ObjectId().toString().slice(-5),
    fullName,
    gender: 'other',
    approximateAge: 30,
  });
  return patient._id.toString();
}

describe('queues module', () => {
  let clinic: TestClinic;

  beforeEach(async () => {
    clinic = await createTestClinic();
  });

  it('generates sequential tokens when adding to the queue', async () => {
    const client = authed(clinic.app, clinic.tokens.receptionist);

    const r1 = await client.post(API).send({ patientId: newPatientId(), source: 'walk_in' });
    const r2 = await client.post(API).send({ patientId: newPatientId(), source: 'walk_in' });
    const r3 = await client.post(API).send({ patientId: newPatientId(), source: 'walk_in' });

    expect(r1.status).toBe(201);
    expect(r1.body.data.token).toBe('A-001');
    expect(r2.body.data.token).toBe('A-002');
    expect(r3.body.data.token).toBe('A-003');
    // appointment/walk_in/quick_entry sources always start checked_in.
    expect(r1.body.data.status).toBe('checked_in');
  });

  it('rejects an invalid state transition', async () => {
    const client = authed(clinic.app, clinic.tokens.receptionist);
    const add = await client.post(API).send({ patientId: newPatientId(), source: 'walk_in' });
    const id = add.body.data.id as string;

    // checked_in cannot jump straight to in_consultation.
    const res = await client.patch(`${API}/${id}/transition`).send({ to: 'in_consultation' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('rejects a valid transition sent with a stale expectedVersion (optimistic concurrency)', async () => {
    const client = authed(clinic.app, clinic.tokens.receptionist);
    const add = await client.post(API).send({ patientId: newPatientId(), source: 'walk_in' });
    const id = add.body.data.id as string;
    expect(add.body.data.version).toBe(0);

    const res = await client
      .patch(`${API}/${id}/transition`)
      .send({ to: 'ready_for_doctor', expectedVersion: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('applies a valid transition and bumps the version', async () => {
    const client = authed(clinic.app, clinic.tokens.receptionist);
    const add = await client.post(API).send({ patientId: newPatientId(), source: 'walk_in' });
    const id = add.body.data.id as string;

    const res = await client
      .patch(`${API}/${id}/transition`)
      .send({ to: 'ready_for_doctor', expectedVersion: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ready_for_doctor');
    expect(res.body.data.version).toBe(1);
  });

  it('requires a reason to skip an entry', async () => {
    const client = authed(clinic.app, clinic.tokens.receptionist);
    const add = await client.post(API).send({ patientId: newPatientId(), source: 'walk_in' });
    const id = add.body.data.id as string;
    await client.patch(`${API}/${id}/transition`).send({ to: 'ready_for_doctor' });

    const res = await client.post(`${API}/${id}/skip`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('repositions a rejoined entry after the next patient in line for the same doctor', async () => {
    const client = authed(clinic.app, clinic.tokens.receptionist);
    const doctorId = clinic.userIds.doctor.toString();

    const a = await client.post(API).send({ patientId: newPatientId(), source: 'walk_in', doctorId });
    const b = await client.post(API).send({ patientId: newPatientId(), source: 'walk_in', doctorId });
    await client.post(API).send({ patientId: newPatientId(), source: 'walk_in', doctorId });
    const idA = a.body.data.id as string;

    await client.patch(`${API}/${idA}/transition`).send({ to: 'ready_for_doctor' });
    const skipRes = await client.post(`${API}/${idA}/skip`).send({ reason: 'stepped out' });
    expect(skipRes.status).toBe(200);
    expect(skipRes.body.data.status).toBe('skipped');

    const rejoinRes = await client
      .post(`${API}/${idA}/rejoin`)
      .send({ policy: 'after_next_patient', reason: 'returned' });

    expect(rejoinRes.status).toBe(200);
    expect(rejoinRes.body.data.status).toBe('rejoined');
    // B is the first active entry (position 1); after_next_patient -> position 1 + 1 = 2.
    expect(rejoinRes.body.data.position).toBe(b.body.data.position + 1);
  });

  it('returns wait estimates as a min/max range, not an exact number', async () => {
    const client = authed(clinic.app, clinic.tokens.receptionist);
    const doctorId = clinic.userIds.doctor.toString();

    await client.post(API).send({ patientId: newPatientId(), source: 'walk_in', doctorId });
    await client.post(API).send({ patientId: newPatientId(), source: 'walk_in', doctorId });
    const third = await client.post(API).send({ patientId: newPatientId(), source: 'walk_in', doctorId });

    expect(third.body.data.estimatedWaitMinMinutes).toBeTypeOf('number');
    expect(third.body.data.estimatedWaitMaxMinutes).toBeTypeOf('number');
    // Two active patients ahead -> a genuine (non-zero-width) range.
    expect(third.body.data.estimatedWaitMaxMinutes).toBeGreaterThan(third.body.data.estimatedWaitMinMinutes);
  });

  it('groups active entries into board columns', async () => {
    const client = authed(clinic.app, clinic.tokens.receptionist);
    const doctorId = clinic.userIds.doctor.toString();

    const waiting = await client.post(API).send({ patientId: newPatientId(), source: 'walk_in', doctorId });
    const ready = await client.post(API).send({ patientId: newPatientId(), source: 'walk_in', doctorId });

    await client.patch(`${API}/${waiting.body.data.id}/transition`).send({ to: 'waiting_for_nurse' });
    await client.patch(`${API}/${ready.body.data.id}/transition`).send({ to: 'ready_for_doctor' });

    const board = await client.get(`${API}?view=board`);

    expect(board.status).toBe(200);
    const waitingTokens = board.body.data.waiting_for_nurse.map((e: { token: string }) => e.token);
    const readyTokens = board.body.data.ready_for_doctor.map((e: { token: string }) => e.token);
    expect(waitingTokens).toContain(waiting.body.data.token);
    expect(readyTokens).toContain(ready.body.data.token);
    // Each entry lands in exactly one column.
    expect(waitingTokens).not.toContain(ready.body.data.token);
    expect(readyTokens).not.toContain(waiting.body.data.token);
  });

  it('never leaks a patient name in the waiting-room display payload', async () => {
    const client = authed(clinic.app, clinic.tokens.receptionist);
    const secretName = 'Extremely Private Name';
    const patientId = await seedPatient(clinic, secretName);
    const doctorId = clinic.userIds.doctor.toString();

    const add = await client.post(API).send({ patientId, source: 'walk_in', doctorId });
    const id = add.body.data.id as string;
    await client.patch(`${API}/${id}/transition`).send({ to: 'ready_for_doctor' });
    const toConsultation = await client.patch(`${API}/${id}/transition`).send({ to: 'in_consultation' });

    // Sanity check: the staff-facing DTO *does* carry the patient's name.
    expect(toConsultation.body.data.patientName).toBe(secretName);

    const display = await queueService.buildDisplayState(
      {
        organizationId: clinic.organizationId,
        clinicId: clinic.clinicId,
        branchId: clinic.branchId,
        timezone: 'Asia/Kolkata',
      },
      clinic.branchId,
      add.body.data.date,
    );

    expect(JSON.stringify(display)).not.toContain(secretName);
    expect(display.nowConsulting.some((c) => c.token === add.body.data.token)).toBe(true);
    expect(display.nowConsulting[0]).not.toHaveProperty('patientName');
  });

  it('requires QUEUE_OVERRIDE for a manually-placed rejoin', async () => {
    const receptionist = authed(clinic.app, clinic.tokens.receptionist);
    const admin = authed(clinic.app, clinic.tokens.clinic_admin);

    const add = await receptionist.post(API).send({ patientId: newPatientId(), source: 'walk_in' });
    const id = add.body.data.id as string;
    await receptionist.patch(`${API}/${id}/transition`).send({ to: 'ready_for_doctor' });
    await receptionist.post(`${API}/${id}/skip`).send({ reason: 'left briefly' });

    // Receptionist has QUEUE_MANAGE but not QUEUE_OVERRIDE -> manual placement is forbidden.
    const denied = await receptionist
      .post(`${API}/${id}/rejoin`)
      .send({ policy: 'manual', manualPosition: 0, reason: 'front desk override' });
    expect(denied.status).toBe(403);

    // Clinic admin has QUEUE_OVERRIDE -> allowed.
    const allowed = await admin
      .post(`${API}/${id}/rejoin`)
      .send({ policy: 'manual', manualPosition: 0, reason: 'front desk override' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.position).toBe(0);
  });
});
