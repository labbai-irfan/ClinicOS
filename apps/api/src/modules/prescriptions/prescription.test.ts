import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@clinicos/types';
import { createTestClinic, authed } from '../../test/helpers';
import { RoleModel } from '../roles/role.model';

function prescriptionBody(consultationId: string, overrides: Record<string, unknown> = {}) {
  return {
    consultationId,
    items: [
      {
        medicineName: 'Paracetamol',
        dose: '500mg',
        frequency: 'Thrice a day',
        durationDays: 5,
        foodRelation: 'after_food',
      },
    ],
    advice: 'Drink plenty of fluids and rest.',
    testsRecommended: ['CBC'],
    includeDiagnosis: true,
    ...overrides,
  };
}

describe('prescriptions module', () => {
  it('creates a draft prescription for a consultation', async () => {
    const { app, tokens } = await createTestClinic();
    const client = authed(app, tokens.doctor);
    const patientId = new Types.ObjectId().toString();

    const consultationRes = await client
      .post('/api/v1/consultations')
      .send({ patientId, diagnosis: ['Viral fever'], complete: true });
    const consultationId = consultationRes.body.data.id as string;

    const res = await client.post('/api/v1/prescriptions').send(prescriptionBody(consultationId));

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.consultationId).toBe(consultationId);
    expect(res.body.data.patientId).toBe(patientId);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.verificationCode).toBeUndefined();
  });

  it('finalizing a draft generates a verificationCode and versionNumber 1', async () => {
    const { app, tokens } = await createTestClinic();
    const client = authed(app, tokens.doctor);
    const patientId = new Types.ObjectId().toString();

    const consultationRes = await client
      .post('/api/v1/consultations')
      .send({ patientId, diagnosis: ['Migraine'], complete: true });
    const consultationId = consultationRes.body.data.id as string;

    await client.post('/api/v1/prescriptions').send(prescriptionBody(consultationId));
    const res = await client
      .post('/api/v1/prescriptions')
      .send(prescriptionBody(consultationId, { finalize: true }));

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('finalized');
    expect(res.body.data.versionNumber).toBe(1);
    expect(res.body.data.verificationCode).toMatch(/^[A-Z0-9]{8}$/);
    expect(res.body.data.finalizedAt).toBeDefined();
  });

  it('finalizing again supersedes the old version and creates version 2', async () => {
    const { app, tokens } = await createTestClinic();
    const client = authed(app, tokens.doctor);
    const patientId = new Types.ObjectId().toString();

    const consultationRes = await client
      .post('/api/v1/consultations')
      .send({ patientId, diagnosis: ['Tonsillitis'], complete: true });
    const consultationId = consultationRes.body.data.id as string;

    const first = await client
      .post('/api/v1/prescriptions')
      .send(prescriptionBody(consultationId, { finalize: true }));
    const firstId = first.body.data.id as string;
    const firstCode = first.body.data.verificationCode as string;

    const second = await client.post('/api/v1/prescriptions').send(
      prescriptionBody(consultationId, {
        finalize: true,
        items: [{ medicineName: 'Amoxicillin', dose: '250mg', frequency: 'Twice a day', durationDays: 7 }],
      }),
    );

    expect(second.status).toBe(201);
    expect(second.body.data.status).toBe('finalized');
    expect(second.body.data.versionNumber).toBe(2);
    expect(second.body.data.id).not.toBe(firstId);
    expect(second.body.data.verificationCode).not.toBe(firstCode);

    const oldRes = await client.get(`/api/v1/prescriptions/${firstId}`);
    expect(oldRes.status).toBe(200);
    expect(oldRes.body.data.status).toBe('superseded');
  });

  it('returns the latest prescription and full version history by consultation', async () => {
    const { app, tokens } = await createTestClinic();
    const client = authed(app, tokens.doctor);
    const patientId = new Types.ObjectId().toString();

    const consultationRes = await client
      .post('/api/v1/consultations')
      .send({ patientId, diagnosis: ['Allergic rhinitis'], complete: true });
    const consultationId = consultationRes.body.data.id as string;

    await client.post('/api/v1/prescriptions').send(prescriptionBody(consultationId, { finalize: true }));
    await client.post('/api/v1/prescriptions').send(
      prescriptionBody(consultationId, {
        finalize: true,
        items: [{ medicineName: 'Cetirizine', dose: '10mg', frequency: 'Once a day', durationDays: 10 }],
      }),
    );

    const res = await client.get(`/api/v1/prescriptions/by-consultation/${consultationId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.current.versionNumber).toBe(2);
    expect(res.body.data.current.status).toBe('finalized');
    expect(res.body.data.history).toHaveLength(2);
    const statuses = (res.body.data.history as Array<{ status: string }>).map((p) => p.status).sort();
    expect(statuses).toEqual(['finalized', 'superseded']);
  });

  it('forbids finalizing without PRESCRIPTION_SIGN even when PRESCRIPTION_CREATE is granted', async () => {
    const { app, tokens, clinicId } = await createTestClinic();

    // Grant the nurse role draft-creation rights but deliberately leave PRESCRIPTION_SIGN off.
    await RoleModel.updateOne(
      { clinicId, key: 'nurse' },
      { $addToSet: { permissions: PERMISSIONS.PRESCRIPTION_CREATE } },
    );

    const doctorClient = authed(app, tokens.doctor);
    const patientId = new Types.ObjectId().toString();
    const consultationRes = await doctorClient
      .post('/api/v1/consultations')
      .send({ patientId, diagnosis: ['Common cold'], complete: true });
    const consultationId = consultationRes.body.data.id as string;

    const nurseClient = authed(app, tokens.nurse);
    const draftRes = await nurseClient.post('/api/v1/prescriptions').send(prescriptionBody(consultationId));
    expect(draftRes.status).toBe(201);

    const finalizeRes = await nurseClient
      .post('/api/v1/prescriptions')
      .send(prescriptionBody(consultationId, { finalize: true }));

    expect(finalizeRes.status).toBe(403);
    expect(finalizeRes.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects a prescription with no medicine items', async () => {
    const { app, tokens } = await createTestClinic();
    const client = authed(app, tokens.doctor);
    const patientId = new Types.ObjectId().toString();

    const consultationRes = await client.post('/api/v1/consultations').send({ patientId, complete: true });
    const consultationId = consultationRes.body.data.id as string;

    const res = await client.post('/api/v1/prescriptions').send({ consultationId, items: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('streams a PDF for a finalized prescription', async () => {
    const { app, tokens } = await createTestClinic();
    const client = authed(app, tokens.doctor);
    const patientId = new Types.ObjectId().toString();

    const consultationRes = await client
      .post('/api/v1/consultations')
      .send({ patientId, diagnosis: ['Sinusitis'], complete: true });
    const consultationId = consultationRes.body.data.id as string;

    const finalizeRes = await client
      .post('/api/v1/prescriptions')
      .send(prescriptionBody(consultationId, { finalize: true }));
    const id = finalizeRes.body.data.id as string;

    const res = await client.get(`/api/v1/prescriptions/${id}/pdf`).buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});
