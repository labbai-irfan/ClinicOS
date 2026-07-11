import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { createTestClinic, authed } from '../../test/helpers';

describe('consultations module', () => {
  it('starts a draft consultation for a queue entry', async () => {
    const { app, tokens, userIds } = await createTestClinic();
    const client = authed(app, tokens.doctor);
    const patientId = new Types.ObjectId().toString();
    const queueEntryId = new Types.ObjectId().toString();

    const res = await client.post('/api/v1/consultations').send({
      patientId,
      queueEntryId,
      symptoms: 'Fever and cough for 3 days',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.doctorId).toBe(userIds.doctor.toString());
    expect(res.body.data.patientId).toBe(patientId);
    expect(res.body.data.completedAt).toBeUndefined();
    expect(res.body.data.version).toBe(0);
  });

  it('completes a consultation when complete=true is sent', async () => {
    const { app, tokens } = await createTestClinic();
    const client = authed(app, tokens.doctor);
    const patientId = new Types.ObjectId().toString();
    const queueEntryId = new Types.ObjectId().toString();

    await client.post('/api/v1/consultations').send({ patientId, queueEntryId, symptoms: 'Fever' });

    const res = await client.post('/api/v1/consultations').send({
      patientId,
      queueEntryId,
      symptoms: 'Fever',
      diagnosis: ['Viral fever'],
      complete: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.completedAt).toBeDefined();
    expect(res.body.data.diagnosis).toEqual(['Viral fever']);
  });

  it('rejects a direct edit through the create endpoint once completed', async () => {
    const { app, tokens } = await createTestClinic();
    const client = authed(app, tokens.doctor);
    const patientId = new Types.ObjectId().toString();
    const queueEntryId = new Types.ObjectId().toString();

    await client
      .post('/api/v1/consultations')
      .send({ patientId, queueEntryId, symptoms: 'Fever', complete: true });

    const res = await client
      .post('/api/v1/consultations')
      .send({ patientId, queueEntryId, symptoms: 'Changed after the fact' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RECORD_FINALIZED');
  });

  it('amends a completed consultation, bumps version, and records amendment history', async () => {
    const { app, tokens } = await createTestClinic();
    const client = authed(app, tokens.doctor);
    const patientId = new Types.ObjectId().toString();
    const queueEntryId = new Types.ObjectId().toString();

    const startRes = await client.post('/api/v1/consultations').send({
      patientId,
      queueEntryId,
      diagnosis: ['Migraine'],
      complete: true,
    });
    const consultationId = startRes.body.data.id as string;

    const amendRes = await client.patch(`/api/v1/consultations/${consultationId}/amend`).send({
      reason: 'Corrected diagnosis after lab report',
      changes: { diagnosis: ['Tension headache'], clinicalNotes: 'Updated after review' },
    });

    expect(amendRes.status).toBe(200);
    expect(amendRes.body.data.status).toBe('amended');
    expect(amendRes.body.data.version).toBe(1);
    expect(amendRes.body.data.diagnosis).toEqual(['Tension headache']);
    expect(amendRes.body.data.clinicalNotes).toBe('Updated after review');

    const historyRes = await client.get(`/api/v1/consultations/${consultationId}/amendments`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data).toHaveLength(1);
    expect(historyRes.body.data[0].reason).toBe('Corrected diagnosis after lab report');
    expect(historyRes.body.data[0].amendedByName).toBeTruthy();
  });

  it('rejects amending a consultation that is not yet completed', async () => {
    const { app, tokens } = await createTestClinic();
    const client = authed(app, tokens.doctor);
    const patientId = new Types.ObjectId().toString();
    const queueEntryId = new Types.ObjectId().toString();

    const startRes = await client
      .post('/api/v1/consultations')
      .send({ patientId, queueEntryId, symptoms: 'Fever' });
    const consultationId = startRes.body.data.id as string;

    const res = await client.patch(`/api/v1/consultations/${consultationId}/amend`).send({
      reason: 'Too early',
      changes: { symptoms: 'Nope' },
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('returns the consultation history for a patient sorted newest first', async () => {
    const { app, tokens } = await createTestClinic();
    const client = authed(app, tokens.doctor);
    const patientId = new Types.ObjectId().toString();

    const first = await client.post('/api/v1/consultations').send({
      patientId,
      queueEntryId: new Types.ObjectId().toString(),
      symptoms: 'Visit one',
      complete: true,
    });
    const second = await client.post('/api/v1/consultations').send({
      patientId,
      queueEntryId: new Types.ObjectId().toString(),
      symptoms: 'Visit two',
      complete: true,
    });

    const res = await client.get(`/api/v1/consultations/by-patient/${patientId}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe(second.body.data.id);
    expect(res.body.data[1].id).toBe(first.body.data.id);
  });

  it('returns a single consultation by id', async () => {
    const { app, tokens } = await createTestClinic();
    const client = authed(app, tokens.doctor);
    const patientId = new Types.ObjectId().toString();

    const startRes = await client.post('/api/v1/consultations').send({
      patientId,
      queueEntryId: new Types.ObjectId().toString(),
      symptoms: 'Fever',
    });

    const res = await client.get(`/api/v1/consultations/${startRes.body.data.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(startRes.body.data.id);
    expect(res.body.data.symptoms).toBe('Fever');
  });

  it('forbids starting a consultation without CONSULTATION_CREATE permission', async () => {
    const { app, tokens } = await createTestClinic();
    const client = authed(app, tokens.nurse);

    const res = await client.post('/api/v1/consultations').send({
      patientId: new Types.ObjectId().toString(),
      queueEntryId: new Types.ObjectId().toString(),
      symptoms: 'Fever',
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
