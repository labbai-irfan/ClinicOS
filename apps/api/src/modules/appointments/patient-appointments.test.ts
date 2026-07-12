import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import request from 'supertest';
import { createTestClinic, authed } from '../../test/helpers';
import { signAccessToken } from '../../middleware/authenticate';
import { PatientModel } from '../patients/patient.model';
import { UserModel } from '../users/user.model';

describe('patient appointments module', () => {
  it('lists patient appointments with happy path', async () => {
    const clinic = await createTestClinic();

    // Create a user and patient record with matching IDs
    const user = await UserModel.create({
      name: 'Test Patient',
      email: 'patient1@test.dev',
      passwordHash: 'hashed',
    });

    const patient = await PatientModel.create({
      _id: user._id, // Match user ID to patient ID
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
      email: 'patient1@test.dev',
      name: 'Test Patient',
    });

    const client = authed(clinic.app, patientToken);

    // Get patient's appointments (should be empty initially)
    const res = await client.get('/api/v1/appointments/patient/me');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const clinic = await createTestClinic();

    const res = await request(clinic.app).get('/api/v1/appointments/patient/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('validates required booking fields with 400', async () => {
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

    // Post without required fields
    const res = await client.post('/api/v1/appointments/patient/book').send({
      reason: 'Test',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('filters appointments by status', async () => {
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

    // Get appointments filtered by status
    const res = await client
      .get('/api/v1/appointments/patient/me')
      .query({ status: 'scheduled' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('filters appointments by date range', async () => {
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

    // Get appointments with date filter
    const res = await client
      .get('/api/v1/appointments/patient/me')
      .query({ dateFrom: '2026-08-01', dateTo: '2026-08-31' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('validates booking with invalid IDs', async () => {
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

    // Post with invalid doctor ID
    const res = await client.post('/api/v1/appointments/patient/book').send({
      doctorId: 'invalid-id',
      branchId: new Types.ObjectId().toString(),
      startTime: '10:00',
      endTime: '10:20',
      reason: 'Test',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
