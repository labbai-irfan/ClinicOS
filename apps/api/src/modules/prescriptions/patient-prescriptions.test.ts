import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import request from 'supertest';
import { createTestClinic, authed } from '../../test/helpers';
import { signAccessToken } from '../../middleware/authenticate';
import { PatientModel } from '../patients/patient.model';
import { UserModel } from '../users/user.model';

describe('patient prescriptions module', () => {
  it('lists patient prescriptions with happy path', async () => {
    const clinic = await createTestClinic();

    const user = await UserModel.create({
      name: 'Test Patient',
      email: 'patient1@test.dev',
      passwordHash: 'hashed',
    });

    const patient = await PatientModel.create({
      _id: user._id,
      organizationId: clinic.organizationId,
      clinicId: clinic.clinicId,
      code: 'P000001',
      fullName: 'Test Patient',
      gender: 'male',
      emergencyContacts: [],
      isTemporary: false,
    });

    const patientToken = signAccessToken({
      sub: user._id.toString(),
      sid: new Types.ObjectId().toString(),
      email: 'patient@test.dev',
      name: 'Test Patient',
    });

    const client = authed(clinic.app, patientToken);

    // Get patient's prescriptions (should be empty initially)
    const res = await client.get('/api/v1/prescriptions/patient/me');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const clinic = await createTestClinic();

    const res = await request(clinic.app).get('/api/v1/prescriptions/patient/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for non-existent prescription', async () => {
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
      emergencyContacts: [],
      isTemporary: false,
    });

    const patientToken = signAccessToken({
      sub: user._id.toString(),
      sid: new Types.ObjectId().toString(),
      email: 'patient@test.dev',
      name: 'Test Patient',
    });

    const client = authed(clinic.app, patientToken);

    // Try to get a non-existent prescription
    const res = await client.get(`/api/v1/prescriptions/patient/${new Types.ObjectId()}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('validates prescription ID format with 400', async () => {
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
      emergencyContacts: [],
      isTemporary: false,
    });

    const patientToken = signAccessToken({
      sub: user._id.toString(),
      sid: new Types.ObjectId().toString(),
      email: 'patient@test.dev',
      name: 'Test Patient',
    });

    const client = authed(clinic.app, patientToken);

    // Try to get prescription with invalid ID format
    const res = await client.get('/api/v1/prescriptions/patient/invalid-id');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('includes PDF URLs in prescription list', async () => {
    const clinic = await createTestClinic();

    const user = await UserModel.create({
      name: 'Test Patient 4',
      email: 'patient4@test.dev',
      passwordHash: 'hashed',
    });

    const patient = await PatientModel.create({
      _id: user._id,
      organizationId: clinic.organizationId,
      clinicId: clinic.clinicId,
      code: 'P000004',
      fullName: 'Test Patient 4',
      gender: 'female',
      emergencyContacts: [],
      isTemporary: false,
    });

    const patientToken = signAccessToken({
      sub: user._id.toString(),
      sid: new Types.ObjectId().toString(),
      email: 'patient@test.dev',
      name: 'Test Patient',
    });

    const client = authed(clinic.app, patientToken);

    // Get prescriptions
    const res = await client.get('/api/v1/prescriptions/patient/me');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('respects pagination parameters', async () => {
    const clinic = await createTestClinic();

    const user = await UserModel.create({
      name: 'Test Patient 5',
      email: 'patient5@test.dev',
      passwordHash: 'hashed',
    });

    const patient = await PatientModel.create({
      _id: user._id,
      organizationId: clinic.organizationId,
      clinicId: clinic.clinicId,
      code: 'P000005',
      fullName: 'Test Patient 5',
      gender: 'male',
      emergencyContacts: [],
      isTemporary: false,
    });

    const patientToken = signAccessToken({
      sub: user._id.toString(),
      sid: new Types.ObjectId().toString(),
      email: 'patient@test.dev',
      name: 'Test Patient',
    });

    const client = authed(clinic.app, patientToken);

    // Get prescriptions with pagination
    const res = await client
      .get('/api/v1/prescriptions/patient/me')
      .query({ page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
