import { describe, expect, it, beforeEach } from 'vitest';
import { DEFAULTS } from '@clinicos/config';
import { authed, createTestClinic, type TestClinic } from '../../test/helpers';

describe('settings module', () => {
  let clinic: TestClinic;

  beforeEach(async () => {
    clinic = await createTestClinic();
  });

  function owner() {
    return authed(clinic.app, clinic.tokens.clinic_owner);
  }

  function receptionist() {
    return authed(clinic.app, clinic.tokens.receptionist);
  }

  it('gets or creates clinic settings with spec defaults on the first call', async () => {
    const res = await owner().get('/api/v1/settings/clinic');

    expect(res.status).toBe(200);
    expect(res.body.data.appointmentWindowMinutes).toBe(DEFAULTS.APPOINTMENT_WINDOW_MINUTES);
    expect(res.body.data.appointmentBufferMinutes).toBe(DEFAULTS.APPOINTMENT_BUFFER_MINUTES);
    expect(res.body.data.rejoinPolicy).toBe(DEFAULTS.REJOIN_POLICY);
    expect(res.body.data.walkInCapacityPerDay).toBe(50);
    expect(res.body.data.prescriptionShowDiagnosisDefault).toBe(false);

    // Calling again must return the same document, not create a second one.
    const again = await owner().get('/api/v1/settings/clinic');
    expect(again.body.data.id).toBe(res.body.data.id);
  });

  it('updates clinic settings', async () => {
    const res = await owner().patch('/api/v1/settings/clinic').send({
      appointmentWindowMinutes: 30,
      walkInCapacityPerDay: 80,
      rejoinPolicy: 'manual',
      prescriptionShowDiagnosisDefault: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.appointmentWindowMinutes).toBe(30);
    expect(res.body.data.walkInCapacityPerDay).toBe(80);
    expect(res.body.data.rejoinPolicy).toBe('manual');
    expect(res.body.data.prescriptionShowDiagnosisDefault).toBe(true);
    // Untouched field keeps its default.
    expect(res.body.data.appointmentBufferMinutes).toBe(DEFAULTS.APPOINTMENT_BUFFER_MINUTES);

    const fetched = await owner().get('/api/v1/settings/clinic');
    expect(fetched.body.data.appointmentWindowMinutes).toBe(30);
  });

  it('gets or creates token settings per branch with spec defaults', async () => {
    const branchId = clinic.branchId.toString();

    const res = await owner().get(`/api/v1/settings/tokens?branchId=${branchId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.branchId).toBe(branchId);
    expect(res.body.data.mode).toBe('branch');
    expect(res.body.data.prefix).toBe(DEFAULTS.TOKEN_PREFIX);
    expect(res.body.data.pad).toBe(DEFAULTS.TOKEN_PAD);
    expect(res.body.data.dailyReset).toBe(true);

    const again = await owner().get(`/api/v1/settings/tokens?branchId=${branchId}`);
    expect(again.body.data.id).toBe(res.body.data.id);
  });

  it('updates token settings for a branch', async () => {
    const branchId = clinic.branchId.toString();

    const res = await owner().patch('/api/v1/settings/tokens').send({
      branchId,
      mode: 'doctor',
      prefix: 'DR',
      pad: 4,
      dailyReset: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.branchId).toBe(branchId);
    expect(res.body.data.mode).toBe('doctor');
    expect(res.body.data.prefix).toBe('DR');
    expect(res.body.data.pad).toBe(4);
    expect(res.body.data.dailyReset).toBe(false);

    const fetched = await owner().get(`/api/v1/settings/tokens?branchId=${branchId}`);
    expect(fetched.body.data.prefix).toBe('DR');
  });

  it('forbids settings updates for a role without settings.manage', async () => {
    const clinicRes = await receptionist().patch('/api/v1/settings/clinic').send({
      appointmentWindowMinutes: 25,
    });
    expect(clinicRes.status).toBe(403);

    const tokenRes = await receptionist().patch('/api/v1/settings/tokens').send({
      branchId: clinic.branchId.toString(),
      prefix: 'X',
    });
    expect(tokenRes.status).toBe(403);
  });
});
