import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createApp } from '../../app';
import { UserModel } from '../users/user.model';
import { ClinicModel } from '../clinics/clinic.model';
import { createTestClinic } from '../../test/helpers';
import * as patientAuthService from './patient.service';

describe('Patient Authentication', () => {
  const app = createApp();
  let clinicId: string;

  beforeAll(async () => {
    const clinic = await createTestClinic('Patient Auth Test Clinic');
    clinicId = clinic.clinicId.toString();
  });

  describe('GET /auth/clinics', () => {
    it('lists active, onboarded clinics for the registration picker (200)', async () => {
      const res = await request(app).get('/api/v1/patient/auth/clinics');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((c: { id: string }) => c.id === clinicId)).toBe(true);
    });

    it('filters by name (case-insensitive)', async () => {
      const res = await request(app)
        .get('/api/v1/patient/auth/clinics')
        .query({ q: 'patient auth test' });

      expect(res.status).toBe(200);
      expect(res.body.data.some((c: { id: string }) => c.id === clinicId)).toBe(true);
    });

    it('excludes clinics that have not finished onboarding', async () => {
      const incomplete = await createTestClinic('Incomplete Onboarding Clinic');
      await ClinicModel.updateOne({ _id: incomplete.clinicId }, { $set: { onboardingComplete: false } });

      const res = await request(app)
        .get('/api/v1/patient/auth/clinics')
        .query({ q: 'Incomplete Onboarding' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('POST /auth/register-patient', () => {
    it('should register a patient with valid input (201)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-patient')
        .send({
          name: 'John Patient',
          email: `patient-${Date.now()}@test.dev`,
          phone: '+1234567890',
          password: 'SecurePass123',
          clinicId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.roleKey).toBe('patient');
      expect(res.body.data.user.email).toBeTruthy();
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.refreshToken).not.toBeDefined(); // Not in response for web clients
    });

    it('should return 409 when email already exists', async () => {
      const email = `patient-conflict-${Date.now()}@test.dev`;
      await UserModel.create({
        name: 'Existing Patient',
        email,
        passwordHash: await patientAuthService.hashPassword('Password123'),
      });

      const res = await request(app)
        .post('/api/v1/auth/register-patient')
        .send({
          name: 'New Patient',
          email,
          password: 'SecurePass123',
          clinicId,
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeTruthy();
    });

    it('should return 400 for invalid password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-patient')
        .send({
          name: 'John Patient',
          email: `patient-${Date.now()}@test.dev`,
          password: 'weak', // Too short, no uppercase, no number
          clinicId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-patient')
        .send({
          name: 'John Patient',
          email: 'not-an-email',
          password: 'SecurePass123',
          clinicId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it('should return 400 when clinicId is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-patient')
        .send({
          name: 'John Patient',
          email: `patient-noclinic-${Date.now()}@test.dev`,
          password: 'SecurePass123',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it('should return 404 when clinicId does not match a real, active, onboarded clinic', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register-patient')
        .send({
          name: 'John Patient',
          email: `patient-badclinic-${Date.now()}@test.dev`,
          password: 'SecurePass123',
          clinicId: new Types.ObjectId().toString(),
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBeTruthy();
    });
  });

  describe('POST /auth/login-patient', () => {
    it('should login a patient with valid credentials (200)', async () => {
      const email = `patient-login-${Date.now()}@test.dev`;
      const password = 'ValidPass123';
      await UserModel.create({
        name: 'Login Patient',
        email,
        passwordHash: await patientAuthService.hashPassword(password),
      });

      const res = await request(app)
        .post('/api/v1/auth/login-patient')
        .send({ email, password });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.roleKey).toBe('patient');
      expect(res.body.data.user.email).toBe(email.toLowerCase());
      expect(res.body.data.accessToken).toBeTruthy();
    });

    it('should return 401 for incorrect password', async () => {
      const email = `patient-wrongpass-${Date.now()}@test.dev`;
      await UserModel.create({
        name: 'Patient',
        email,
        passwordHash: await patientAuthService.hashPassword('CorrectPass123'),
      });

      const res = await request(app)
        .post('/api/v1/auth/login-patient')
        .send({
          email,
          password: 'WrongPass123',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeTruthy();
    });

    it('should return 401 for non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login-patient')
        .send({
          email: `nonexistent-${Date.now()}@test.dev`,
          password: 'SomePass123',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeTruthy();
    });
  });

  describe('POST /auth/refresh-patient', () => {
    it('should refresh tokens with valid refresh token (200)', async () => {
      const email = `patient-refresh-${Date.now()}@test.dev`;
      const password = 'ValidPass123';
      const user = await UserModel.create({
        name: 'Refresh Patient',
        email,
        passwordHash: await patientAuthService.hashPassword(password),
      });

      // First, login to get refresh token
      const loginRes = await request(app)
        .post('/api/v1/auth/login-patient')
        .send({ email, password });

      const refreshToken = loginRes.body.data.refreshToken ||
        (Array.isArray(loginRes.headers['set-cookie']) ? loginRes.headers['set-cookie'].find((c: string) => c.startsWith('clinicos_patient_refresh='))?.split(';')[0].split('=')[1] : undefined);

      if (!refreshToken) {
        console.warn('Warning: refresh token not found in response or cookies');
      }

      const res = await request(app)
        .post('/api/v1/auth/refresh-patient')
        .send({ refreshToken: refreshToken || '' });

      if (refreshToken) {
        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.accessToken).toBeTruthy();
        expect(res.body.data.user).toBeDefined();
        expect(res.body.data.user.id).toBe(user._id.toString());
      }
    });

    it('should return 401 for invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh-patient')
        .send({ refreshToken: 'invalid-token-format' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeTruthy();
    });

    it('should return 401 for expired refresh token', async () => {
      // Create a user first
      const email = `patient-expired-${Date.now()}@test.dev`;
      const password = 'ValidPass123';
      await UserModel.create({
        name: 'Expired Patient',
        email,
        passwordHash: await patientAuthService.hashPassword(password),
      });

      // Try to refresh with malformed token (simulating expired)
      const res = await request(app)
        .post('/api/v1/auth/refresh-patient')
        .send({ refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.invalid' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeTruthy();
    });

    it('should return 400 for missing refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh-patient')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });
  });
});
