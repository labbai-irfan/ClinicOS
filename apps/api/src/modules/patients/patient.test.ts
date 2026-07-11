import { describe, expect, it, beforeEach } from 'vitest';
import { authed, createTestClinic, type TestClinic } from '../../test/helpers';

describe('patients module', () => {
  let clinic: TestClinic;

  beforeEach(async () => {
    clinic = await createTestClinic();
  });

  function receptionist() {
    return authed(clinic.app, clinic.tokens.receptionist);
  }

  function clinicAdmin() {
    return authed(clinic.app, clinic.tokens.clinic_admin);
  }

  it('creates a patient via quick registration with a generated P-###### code', async () => {
    const res = await receptionist().post('/api/v1/patients').send({
      fullName: 'Asha Rao',
      gender: 'female',
      approximateAge: 34,
      mobile: '9876543210',
      isTemporary: false,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toMatch(/^P-\d{6}$/);
    expect(res.body.data.fullName).toBe('Asha Rao');
    expect(res.body.data.alerts).toEqual([]);
  });

  it('surfaces a duplicate candidate by mobile without blocking creation', async () => {
    const client = receptionist();
    await client.post('/api/v1/patients').send({
      fullName: 'Ravi Kumar',
      gender: 'male',
      approximateAge: 40,
      mobile: '9998887770',
      isTemporary: false,
    });

    const res = await client.get('/api/v1/patients/check-duplicates?mobile=9998887770');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].mobile).toBe('9998887770');
  });

  it('searches patients by mobile', async () => {
    const client = receptionist();
    await client.post('/api/v1/patients').send({
      fullName: 'Meena Iyer',
      gender: 'female',
      approximateAge: 29,
      mobile: '9123456780',
      isTemporary: false,
    });

    const res = await client.get('/api/v1/patients?mobile=9123456780');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].fullName).toBe('Meena Iyer');
    expect(res.body.meta.total).toBe(1);
  });

  it('computes alerts from recorded allergies and conditions on the profile', async () => {
    const client = receptionist();
    const createRes = await client.post('/api/v1/patients').send({
      fullName: 'Deepak Nair',
      gender: 'male',
      approximateAge: 50,
      isTemporary: false,
    });
    const id = createRes.body.data.id as string;

    await client.patch(`/api/v1/patients/${id}`).send({
      allergies: ['Penicillin'],
      conditions: ['Diabetes'],
    });

    const res = await client.get(`/api/v1/patients/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toEqual(
      expect.arrayContaining([
        { kind: 'allergy', label: 'Penicillin', severity: 'warning' },
        { kind: 'clinical', label: 'Diabetes', severity: 'info' },
      ]),
    );
    expect(typeof res.body.data.age).toBe('number');
  });

  it('updates patient fields', async () => {
    const client = receptionist();
    const createRes = await client.post('/api/v1/patients').send({
      fullName: 'Old Name',
      gender: 'other',
      approximateAge: 20,
      isTemporary: false,
    });
    const id = createRes.body.data.id as string;

    const res = await client.patch(`/api/v1/patients/${id}`).send({ fullName: 'New Name', city: 'Pune' });

    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe('New Name');
    expect(res.body.data.city).toBe('Pune');
  });

  it('merges a duplicate into a primary record and excludes it from subsequent search', async () => {
    const receptionist_client = receptionist();
    const admin_client = clinicAdmin();

    const primaryRes = await receptionist_client.post('/api/v1/patients').send({
      fullName: 'Primary Patient',
      gender: 'male',
      approximateAge: 45,
      mobile: '9001112223',
      isTemporary: false,
    });
    const duplicateRes = await receptionist_client.post('/api/v1/patients').send({
      fullName: 'Primary Patient Duplicate',
      gender: 'male',
      approximateAge: 45,
      mobile: '9001112224',
      isTemporary: false,
    });

    const mergeRes = await admin_client.post('/api/v1/patients/merge').send({
      primaryId: primaryRes.body.data.id,
      duplicateId: duplicateRes.body.data.id,
      reason: 'Confirmed same patient at reception desk.',
    });
    expect(mergeRes.status).toBe(200);
    expect(mergeRes.body.data.duplicate.id).toBe(duplicateRes.body.data.id);

    const searchRes = await receptionist_client.get('/api/v1/patients?q=Primary Patient Duplicate');
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data).toHaveLength(0);
  });

  it('forbids patient creation for a role without patient.create permission', async () => {
    const doctorClient = authed(clinic.app, clinic.tokens.doctor);

    const res = await doctorClient.post('/api/v1/patients').send({
      fullName: 'Should Fail',
      gender: 'male',
      approximateAge: 30,
      isTemporary: false,
    });

    expect(res.status).toBe(403);
  });
});
