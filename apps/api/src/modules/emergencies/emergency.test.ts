import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CODES, SOCKET_EVENTS } from '@clinicos/types';
import { createTestClinic, authed, type TestClinic } from '../../test/helpers';
import { EmergencyCaseModel } from './emergency.model';
import { EmergencyEventModel } from './emergency-event.model';

vi.mock('../../realtime/emit', () => ({
  emitToBranch: vi.fn(),
  emitToClinic: vi.fn(),
  emitToDisplay: vi.fn(),
  emitToUser: vi.fn(),
}));

import { emitToBranch, emitToUser } from '../../realtime/emit';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

describe('emergencies module', () => {
  let clinic: TestClinic;

  beforeEach(async () => {
    vi.clearAllMocks();
    clinic = await createTestClinic();
  });

  it('quick-entry create never requires patientId, mobile, or a name — only mainConcern', async () => {
    const res = await authed(clinic.app, clinic.tokens.receptionist)
      .post('/api/v1/emergencies')
      .send({ mainConcern: 'Collapsed at bus stop, unresponsive' });

    expect(res.status).toBe(201);
    const dto = res.body.data;
    expect(dto.caseCode).toMatch(/^ER-\d{4}-\d{4}$/);
    expect(dto.status).toBe('awaiting_triage');
    expect(dto.priority).toBe('unconfirmed');
    expect(dto.patientId).toBeUndefined();
    expect(dto.patientLabel).toBe('Unidentified');

    const events = await EmergencyEventModel.find({ emergencyCaseId: dto.id }).lean();
    expect(events).toHaveLength(1);
    expect(events[0]!.action).toBe('arrival');
    expect(events[0]!.toStatus).toBe('awaiting_triage');
  });

  it('derives patientLabel from the given name when present, otherwise from gender + approximate age', async () => {
    const named = await authed(clinic.app, clinic.tokens.receptionist)
      .post('/api/v1/emergencies')
      .send({ mainConcern: 'Chest pain', name: 'Asha Rao' });
    expect(named.body.data.patientLabel).toBe('Asha Rao');

    const unnamed = await authed(clinic.app, clinic.tokens.receptionist)
      .post('/api/v1/emergencies')
      .send({ mainConcern: 'Found unconscious', gender: 'male', approximateAge: 40 });
    expect(unnamed.body.data.patientLabel).toBe('Unidentified (Male, approx. 40y)');
  });

  it('priority stays unconfirmed until triage explicitly confirms it, then records who confirmed it', async () => {
    const createRes = await authed(clinic.app, clinic.tokens.nurse)
      .post('/api/v1/emergencies')
      .send({ mainConcern: 'Fall from height' });
    const id = createRes.body.data.id;

    // create() alone must never assign clinical priority — it is only ever
    // assigned/confirmed by authorized staff via triage().
    expect(createRes.body.data.priority).toBe('unconfirmed');
    expect(createRes.body.data.priorityConfirmedBy).toBeUndefined();

    const triageRes = await authed(clinic.app, clinic.tokens.nurse)
      .post(`/api/v1/emergencies/${id}/triage`)
      .send({ priority: 'critical', notes: 'Suspected spinal injury' });

    expect(triageRes.status).toBe(200);
    expect(triageRes.body.data.priority).toBe('critical');
    expect(triageRes.body.data.priorityConfirmedBy).toBe(clinic.userIds.nurse.toString());
    expect(triageRes.body.data.status).toBe('triage_in_progress');
  });

  it('rejects a transition that is not allowed from the current status', async () => {
    const createRes = await authed(clinic.app, clinic.tokens.nurse)
      .post('/api/v1/emergencies')
      .send({ mainConcern: 'Snake bite' });
    const id = createRes.body.data.id;

    await authed(clinic.app, clinic.tokens.nurse)
      .post(`/api/v1/emergencies/${id}/triage`)
      .send({ priority: 'urgent' });

    // triage_in_progress cannot jump straight to "transferred".
    const res = await authed(clinic.app, clinic.tokens.doctor)
      .patch(`/api/v1/emergencies/${id}/status`)
      .send({ to: 'transferred' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(ERROR_CODES.INVALID_TRANSITION);
  });

  it('emits a distinct, urgent doctor-alert event to the branch and to the assigned doctor when status moves to doctor_alerted', async () => {
    const createRes = await authed(clinic.app, clinic.tokens.nurse)
      .post('/api/v1/emergencies')
      .send({ mainConcern: 'Severe breathing difficulty' });
    const id = createRes.body.data.id;

    // Assign the doctor while still awaiting_triage, i.e. BEFORE doctor_alerted is a
    // valid transition, so assign() does not auto-fire the alert itself here — this
    // isolates the assertion to the explicit transition below.
    await authed(clinic.app, clinic.tokens.clinic_owner)
      .post(`/api/v1/emergencies/${id}/assign`)
      .send({ doctorId: clinic.userIds.doctor.toString() });

    await authed(clinic.app, clinic.tokens.nurse)
      .post(`/api/v1/emergencies/${id}/triage`)
      .send({ priority: 'critical' });

    const res = await authed(clinic.app, clinic.tokens.doctor)
      .patch(`/api/v1/emergencies/${id}/status`)
      .send({ to: 'doctor_alerted' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('doctor_alerted');

    const branchAlertCall = vi
      .mocked(emitToBranch)
      .mock.calls.find((call) => call[1] === SOCKET_EVENTS.EMERGENCY_DOCTOR_ALERT);
    expect(branchAlertCall).toBeDefined();
    expect(branchAlertCall?.[0].toString()).toBe(clinic.branchId.toString());

    const userAlertCall = vi
      .mocked(emitToUser)
      .mock.calls.find((call) => call[1] === SOCKET_EVENTS.EMERGENCY_DOCTOR_ALERT);
    expect(userAlertCall).toBeDefined();
    expect(userAlertCall?.[0].toString()).toBe(clinic.userIds.doctor.toString());
  });

  it('assigns a doctor and nurse without forcing an invalid transition', async () => {
    const createRes = await authed(clinic.app, clinic.tokens.receptionist)
      .post('/api/v1/emergencies')
      .send({ mainConcern: 'Minor laceration' });
    const id = createRes.body.data.id;

    // Fresh case is awaiting_triage; awaiting_triage -> doctor_alerted is not a valid
    // transition, so assigning a doctor here must NOT force the status to change.
    const res = await authed(clinic.app, clinic.tokens.clinic_owner)
      .post(`/api/v1/emergencies/${id}/assign`)
      .send({ doctorId: clinic.userIds.doctor.toString(), nurseId: clinic.userIds.nurse.toString() });

    expect(res.status).toBe(200);
    expect(res.body.data.assignedDoctorId).toBe(clinic.userIds.doctor.toString());
    expect(res.body.data.assignedNurseId).toBe(clinic.userIds.nurse.toString());
    expect(res.body.data.status).toBe('awaiting_triage');

    const events = await EmergencyEventModel.find({ emergencyCaseId: id }).lean();
    expect(events.map((e) => e.action)).toEqual(['arrival', 'assigned']);
  });

  it('records a referral, sets the referral field, and moves toward referral_required when valid', async () => {
    const createRes = await authed(clinic.app, clinic.tokens.nurse)
      .post('/api/v1/emergencies')
      .send({ mainConcern: 'Needs specialist care' });
    const id = createRes.body.data.id;

    await authed(clinic.app, clinic.tokens.nurse)
      .post(`/api/v1/emergencies/${id}/triage`)
      .send({ priority: 'urgent' });
    await authed(clinic.app, clinic.tokens.doctor)
      .patch(`/api/v1/emergencies/${id}/status`)
      .send({ to: 'under_assessment' });

    const res = await authed(clinic.app, clinic.tokens.doctor)
      .post(`/api/v1/emergencies/${id}/referral`)
      .send({ facilityName: 'City General Hospital', reason: 'Needs ICU bed', transportMode: 'ambulance' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('referral_required');

    const doc = await EmergencyCaseModel.findById(id).lean();
    expect(doc?.referral?.facilityName).toBe('City General Hospital');
    expect(doc?.referral?.reason).toBe('Needs ICU bed');

    const events = await EmergencyEventModel.find({ emergencyCaseId: id, action: 'referral_initiated' }).lean();
    expect(events).toHaveLength(1);
    expect(events[0]!.toStatus).toBe('referral_required');
  });

  it('appends repeated observation notes without changing status', async () => {
    const createRes = await authed(clinic.app, clinic.tokens.nurse)
      .post('/api/v1/emergencies')
      .send({ mainConcern: 'Under observation after treatment' });
    const id = createRes.body.data.id;

    const first = await authed(clinic.app, clinic.tokens.doctor)
      .post(`/api/v1/emergencies/${id}/observation`)
      .send({ note: 'Vitals stable at 10:05' });
    const second = await authed(clinic.app, clinic.tokens.doctor)
      .post(`/api/v1/emergencies/${id}/observation`)
      .send({ note: 'Vitals stable at 10:35' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.data.status).toBe('awaiting_triage');
    expect(second.body.data.status).toBe('awaiting_triage');

    const events = await EmergencyEventModel.find({ emergencyCaseId: id, action: 'observation_note' })
      .sort({ createdAt: 1 })
      .lean();
    expect(events).toHaveLength(2);
    expect(events[0]!.notes).toBe('Vitals stable at 10:05');
    expect(events[1]!.notes).toBe('Vitals stable at 10:35');
  });

  it('board lists active (non-closed) cases oldest-arrival-first and never mixes in the normal queue', async () => {
    const a = await authed(clinic.app, clinic.tokens.receptionist)
      .post('/api/v1/emergencies')
      .send({ mainConcern: 'Case A', arrivalAt: new Date('2026-07-11T08:00:00Z').toISOString() });
    const b = await authed(clinic.app, clinic.tokens.receptionist)
      .post('/api/v1/emergencies')
      .send({ mainConcern: 'Case B', arrivalAt: new Date('2026-07-11T06:00:00Z').toISOString() });

    const res = await authed(clinic.app, clinic.tokens.nurse).get('/api/v1/emergencies');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((d: { id: string }) => d.id);
    expect(ids.indexOf(b.body.data.id)).toBeLessThan(ids.indexOf(a.body.data.id));
    for (const item of res.body.data as Array<{ status: string }>) {
      expect(item.status).not.toBe('closed');
    }
  });

  it('never imports QueueEntryModel — the emergency board must stay fully independent of the normal queue (spec §20)', () => {
    const files = [
      'emergency.service.ts',
      'emergency.controller.ts',
      'emergency.routes.ts',
      'emergency.model.ts',
      'emergency-event.model.ts',
    ];
    for (const file of files) {
      const contents = readFileSync(path.join(currentDir, file), 'utf8');
      expect(contents).not.toMatch(/QueueEntryModel/);
      expect(contents.toLowerCase()).not.toContain('queue-entry.model');
      expect(contents.toLowerCase()).not.toContain("from '../queues");
    }
  });
});
