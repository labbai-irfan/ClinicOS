import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { authed, createTestClinic } from '../../test/helpers';
import { NurseAssessmentModel } from './nurse-assessment.model';

function ids() {
  return { patientId: new Types.ObjectId().toString(), queueEntryId: new Types.ObjectId().toString() };
}

describe('nurse-assessments', () => {
  it('starts a draft assessment', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.nurse);
    const { patientId, queueEntryId } = ids();

    const res = await api.post('/api/v1/nurse-assessments').send({
      patientId,
      queueEntryId,
      chiefComplaint: 'Fever and headache since 2 days',
      symptoms: ['fever', 'headache'],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.patientId).toBe(patientId);
    expect(res.body.data.queueEntryId).toBe(queueEntryId);
    expect(res.body.data.completedAt).toBeUndefined();
  });

  it('upserts the same queueEntryId in place instead of duplicating', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.nurse);
    const { patientId, queueEntryId } = ids();

    const first = await api.post('/api/v1/nurse-assessments').send({
      patientId,
      queueEntryId,
      chiefComplaint: 'Sore throat',
      symptoms: ['sore throat'],
    });
    expect(first.status).toBe(201);

    const second = await api.post('/api/v1/nurse-assessments').send({
      patientId,
      queueEntryId,
      chiefComplaint: 'Sore throat, now with mild fever',
      symptoms: ['sore throat', 'fever'],
      painLevel: 3,
    });
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.chiefComplaint).toBe('Sore throat, now with mild fever');
    expect(second.body.data.painLevel).toBe(3);

    const count = await NurseAssessmentModel.countDocuments({
      queueEntryId: new Types.ObjectId(queueEntryId),
    });
    expect(count).toBe(1);
  });

  it('marks the assessment completed and stamps completedAt when complete:true', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.nurse);
    const { patientId, queueEntryId } = ids();

    await api.post('/api/v1/nurse-assessments').send({
      patientId,
      queueEntryId,
      chiefComplaint: 'Abdominal pain',
      symptoms: ['pain'],
    });

    const final = await api.post('/api/v1/nurse-assessments').send({
      patientId,
      queueEntryId,
      chiefComplaint: 'Abdominal pain',
      symptoms: ['pain'],
      complete: true,
    });

    expect(final.status).toBe(200);
    expect(final.body.data.status).toBe('completed');
    expect(typeof final.body.data.completedAt).toBe('string');
  });

  it('fetches the current assessment by queue entry', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.nurse);
    const { patientId, queueEntryId } = ids();

    await api.post('/api/v1/nurse-assessments').send({
      patientId,
      queueEntryId,
      chiefComplaint: 'Cough',
      symptoms: ['cough'],
    });

    const res = await api.get(`/api/v1/nurse-assessments/by-queue-entry/${queueEntryId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.queueEntryId).toBe(queueEntryId);
    expect(res.body.data.chiefComplaint).toBe('Cough');
  });

  it('returns a patient assessment history list', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.nurse);
    const patientId = new Types.ObjectId().toString();

    await api.post('/api/v1/nurse-assessments').send({
      patientId,
      queueEntryId: new Types.ObjectId().toString(),
      chiefComplaint: 'Visit one',
      symptoms: [],
    });
    await api.post('/api/v1/nurse-assessments').send({
      patientId,
      queueEntryId: new Types.ObjectId().toString(),
      chiefComplaint: 'Visit two',
      symptoms: [],
    });

    const res = await api.get(`/api/v1/nurse-assessments/by-patient/${patientId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((a: { chiefComplaint: string }) => a.chiefComplaint).sort()).toEqual([
      'Visit one',
      'Visit two',
    ]);
  });

  it('forbids receptionists from creating an assessment', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.receptionist);
    const { patientId, queueEntryId } = ids();

    const res = await api.post('/api/v1/nurse-assessments').send({
      patientId,
      queueEntryId,
      chiefComplaint: 'Fever',
      symptoms: [],
    });

    expect(res.status).toBe(403);
  });
});
