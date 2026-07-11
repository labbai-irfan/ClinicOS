import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { authed, createTestClinic } from '../../test/helpers';

function ids() {
  return { patientId: new Types.ObjectId().toString(), queueEntryId: new Types.ObjectId().toString() };
}

describe('vitals', () => {
  it('computes BMI server-side from height and weight, ignoring any client-sent value', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.nurse);
    const { patientId, queueEntryId } = ids();

    const res = await api.post('/api/v1/vitals').send({
      patientId,
      queueEntryId,
      heightCm: 170,
      weightKg: 70,
      // A malicious/incorrect client-sent bmi must never be trusted.
      bmi: 999,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.heightCm).toBe(170);
    expect(res.body.data.weightKg).toBe(70);
    expect(res.body.data.bmi).toBeCloseTo(24.2, 1);
  });

  it('leaves bmi undefined when height or weight is missing', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.nurse);
    const { patientId, queueEntryId } = ids();

    const res = await api.post('/api/v1/vitals').send({
      patientId,
      queueEntryId,
      weightKg: 70,
      pulseBpm: 82,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.bmi).toBeUndefined();
    expect(res.body.data.pulseBpm).toBe(82);
  });

  it('lists vitals for a patient sorted by recordedAt descending', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.nurse);
    const patientId = new Types.ObjectId().toString();

    await api.post('/api/v1/vitals').send({ patientId, temperatureC: 37.1 });
    await api.post('/api/v1/vitals').send({ patientId, temperatureC: 38.4 });

    const res = await api.get(`/api/v1/vitals?patientId=${patientId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((v: { patientId: string }) => v.patientId === patientId)).toBe(true);
    // Most recently recorded first.
    expect(res.body.data[0].temperatureC).toBe(38.4);
    expect(res.body.data[1].temperatureC).toBe(37.1);
  });

  it('lists vitals filtered by queueEntryId', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.nurse);
    const { patientId, queueEntryId } = ids();
    const otherQueueEntryId = new Types.ObjectId().toString();

    await api.post('/api/v1/vitals').send({ patientId, queueEntryId, pulseBpm: 76 });
    await api.post('/api/v1/vitals').send({
      patientId,
      queueEntryId: otherQueueEntryId,
      pulseBpm: 90,
    });

    const res = await api.get(`/api/v1/vitals?queueEntryId=${queueEntryId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].queueEntryId).toBe(queueEntryId);
    expect(res.body.data[0].pulseBpm).toBe(76);
  });

  it('forbids recording vitals without VITALS_CREATE permission', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.receptionist);
    const { patientId, queueEntryId } = ids();

    const res = await api.post('/api/v1/vitals').send({
      patientId,
      queueEntryId,
      pulseBpm: 80,
    });

    expect(res.status).toBe(403);
  });
});
