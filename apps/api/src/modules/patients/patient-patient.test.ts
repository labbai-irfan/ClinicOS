import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import request from 'supertest';
import { createTestClinic, authed } from '../../test/helpers';
import { signAccessToken } from '../../middleware/authenticate';
import { PatientModel } from './patient.model';
import { UserModel } from '../users/user.model';

describe('patient profile module', () => {
  it('retrieves patient profile with happy path', async () => {
    const clinic = await createTestClinic();

    const user = await UserModel.create({
      name: 'Test Patient',
      email: 'patient1@test.dev',
      passwordHash: 'hashed',
    });

    // Create a patient record matching user ID
    const patient = await PatientModel.create({
      _id: user._id,
      organizationId: clinic.organizationId,
      clinicId: clinic.clinicId,
      code: 'P000001',
      fullName: 'Test Patient',
      gender: 'male',
      dateOfBirth: new Date('1990-01-01'),
      mobile: '1234567890',
      email: 'patient1@test.dev',
      allergies: ['Penicillin'],
      conditions: ['Diabetes'],
      emergencyContacts: [],
      isTemporary: false,
    });

    const patientToken = signAccessToken({
      sub: user._id.toString(),
      sid: new Types.ObjectId().toString(),
      email: 'patient1@test.dev',
      name: 'Test Patient',
    });

    const client = authed(clinic.app, patientToken);

    // Get patient's own profile
    const res = await client.get('/api/v1/patients/patient/me');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(patient._id.toString());
    expect(res.body.data.fullName).toBe('Test Patient');
    expect(res.body.data.gender).toBe('male');
    expect(res.body.data.mobile).toBe('1234567890');
    expect(res.body.data.email).toBe('patient1@test.dev');
    expect(res.body.data.allergies).toContain('Penicillin');
    expect(res.body.data.conditions).toContain('Diabetes');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const clinic = await createTestClinic();

    const res = await request(clinic.app).get('/api/v1/patients/patient/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for non-existent patient record', async () => {
    const clinic = await createTestClinic();
    const nonExistentPatientId = new Types.ObjectId();
    const patientToken = signAccessToken({
      sub: nonExistentPatientId.toString(),
      sid: new Types.ObjectId().toString(),
      email: 'nonexistent@test.dev',
      name: 'Non-existent Patient',
    });

    const client = authed(clinic.app, patientToken);

    // Try to get profile for non-existent patient
    const res = await client.get('/api/v1/patients/patient/me');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('includes allergies and conditions in response', async () => {
    const clinic = await createTestClinic();

    const user = await UserModel.create({
      name: 'Test Patient 2',
      email: 'patient2@test.dev',
      passwordHash: 'hashed',
    });

    const patient = await PatientModel.create({
      _id: user._id,
      organizationId: clinic.organizationId,
      clinicId: clinic.clinicId,
      code: 'P000002',
      fullName: 'Test Patient 2',
      gender: 'female',
      mobile: '9876543210',
      allergies: ['Aspirin', 'NSAIDs'],
      conditions: ['Hypertension', 'Asthma'],
      emergencyContacts: [],
      isTemporary: false,
    });

    const patientToken = signAccessToken({
      sub: user._id.toString(),
      sid: new Types.ObjectId().toString(),
      email: 'patient2@test.dev',
      name: 'Test Patient 2',
    });

    const client = authed(clinic.app, patientToken);

    const res = await client.get('/api/v1/patients/patient/me');

    expect(res.status).toBe(200);
    expect(res.body.data.allergies).toEqual(['Aspirin', 'NSAIDs']);
    expect(res.body.data.conditions).toEqual(['Hypertension', 'Asthma']);
  });

  it('returns patient alerts for allergies and conditions', async () => {
    const clinic = await createTestClinic();

    const user = await UserModel.create({
      name: 'Test Patient 3',
      email: 'patient3@test.dev',
      passwordHash: 'hashed',
    });

    const patient = await PatientModel.create({
      _id: user._id,
      organizationId: clinic.organizationId,
      clinicId: clinic.clinicId,
      code: 'P000003',
      fullName: 'Test Patient 3',
      gender: 'male',
      allergies: ['Peanuts'],
      conditions: ['COVID-19'],
      emergencyContacts: [],
      isTemporary: false,
    });

    const patientToken = signAccessToken({
      sub: user._id.toString(),
      sid: new Types.ObjectId().toString(),
      email: 'patient3@test.dev',
      name: 'Test Patient 3',
    });

    const client = authed(clinic.app, patientToken);

    const res = await client.get('/api/v1/patients/patient/me');

    expect(res.status).toBe(200);
    expect(res.body.data.alerts).toBeDefined();
    expect(Array.isArray(res.body.data.alerts)).toBe(true);
    // Should contain alerts for allergy and condition
    const hasAllergyAlert = res.body.data.alerts.some(
      (a: any) => a.kind === 'allergy' && a.label === 'Peanuts'
    );
    const hasConditionAlert = res.body.data.alerts.some(
      (a: any) => a.kind === 'clinical' && a.label === 'COVID-19'
    );
    expect(hasAllergyAlert).toBe(true);
    expect(hasConditionAlert).toBe(true);
  });
});
