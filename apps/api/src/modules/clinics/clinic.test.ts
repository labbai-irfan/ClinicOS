import { describe, expect, it, beforeEach } from 'vitest';
import { authed, createTestClinic, type TestClinic } from '../../test/helpers';
import { AuditLogModel } from '../audit-logs/audit-log.model';
import { BranchModel } from '../branches/branch.model';
import { MembershipModel } from '../memberships/membership.model';
import { ClinicModel } from './clinic.model';

describe('clinics module', () => {
  let clinic: TestClinic;

  beforeEach(async () => {
    clinic = await createTestClinic();
  });

  function owner() {
    return authed(clinic.app, clinic.tokens.clinic_owner);
  }

  /** Put the seeded clinic back into a "mid-onboarding" state (createTestClinic marks it complete). */
  async function resetOnboarding() {
    await ClinicModel.updateOne(
      { _id: clinic.clinicId },
      { $set: { onboardingComplete: false, onboardingStep: 1 } },
    );
  }

  it('returns the caller-scoped clinic record on GET /clinics/me', async () => {
    const res = await owner().get('/api/v1/clinics/me');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(clinic.clinicId.toString());
    expect(res.body.data.organizationId).toBe(clinic.organizationId.toString());
    expect(res.body.data.slug).toBeTruthy();
    expect(res.body.data.timezone).toBe('Asia/Kolkata');
    expect(res.body.data.onboardingComplete).toBe(true);
    expect(res.body.data.isActive).toBe(true);
    expect(typeof res.body.data.onboardingStep).toBe('number');
  });

  it('allows any staff role to read the clinic record', async () => {
    const res = await authed(clinic.app, clinic.tokens.doctor).get('/api/v1/clinics/me');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(clinic.clinicId.toString());
  });

  it('updates identity and prescription branding via PATCH /clinics/me and audits it', async () => {
    const res = await owner().patch('/api/v1/clinics/me').send({
      name: 'Sunrise Clinic',
      phone: '9876543210',
      email: 'Hello@Sunrise.dev',
      timezone: 'Asia/Dubai',
      prescriptionHeader: 'Sunrise Clinic — Care first',
      prescriptionFooter: 'Get well soon',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Sunrise Clinic');
    expect(res.body.data.phone).toBe('9876543210');
    expect(res.body.data.email).toBe('hello@sunrise.dev');
    expect(res.body.data.timezone).toBe('Asia/Dubai');
    expect(res.body.data.prescriptionHeader).toBe('Sunrise Clinic — Care first');
    expect(res.body.data.prescriptionFooter).toBe('Get well soon');

    const auditEntry = await AuditLogModel.findOne({
      clinicId: clinic.clinicId,
      action: 'clinic.update',
    }).lean();
    expect(auditEntry).not.toBeNull();
  });

  it('supports partial updates without touching other fields', async () => {
    await owner().patch('/api/v1/clinics/me').send({ prescriptionHeader: 'Header only' });

    const res = await owner().get('/api/v1/clinics/me');
    expect(res.body.data.prescriptionHeader).toBe('Header only');
    expect(res.body.data.name).toContain('Test Clinic');
  });

  it('rejects an invalid identity payload with 400', async () => {
    const res = await owner().patch('/api/v1/clinics/me').send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a timezone that is not a valid IANA identifier', async () => {
    const res = await owner().patch('/api/v1/clinics/me').send({ timezone: 'Asia/Kolkataa' });

    expect(res.status).toBe(400);

    // The clinic's timezone (and therefore every available-slots/booking call) is untouched.
    const after = await owner().get('/api/v1/clinics/me');
    expect(after.body.data.timezone).toBe('Asia/Kolkata');
  });

  it('saves an identity change even when phone/email are blank, and can clear a previously-set phone', async () => {
    await owner().patch('/api/v1/clinics/me').send({ phone: '9876543210' });

    // Untouched-optional-field submissions (the web form always sends `''`, never
    // omits the key) must not be rejected as invalid mobile numbers.
    const renameOnly = await owner().patch('/api/v1/clinics/me').send({ name: 'Renamed Clinic', phone: '', email: '' });
    expect(renameOnly.status).toBe(200);
    expect(renameOnly.body.data.name).toBe('Renamed Clinic');
    // '' is an explicit clear, not "leave unchanged".
    expect(renameOnly.body.data.phone).toBeUndefined();
  });

  it('forbids clinic mutations for roles without manage permissions', async () => {
    const doctorPatch = await authed(clinic.app, clinic.tokens.doctor)
      .patch('/api/v1/clinics/me')
      .send({ name: 'Hijacked' });
    const receptionistStep = await authed(clinic.app, clinic.tokens.receptionist)
      .patch('/api/v1/clinics/me/onboarding-step')
      .send({ step: 2 });
    const nurseActivate = await authed(clinic.app, clinic.tokens.nurse)
      .post('/api/v1/clinics/me/activate')
      .send({});

    expect(doctorPatch.status).toBe(403);
    expect(receptionistStep.status).toBe(403);
    expect(nurseActivate.status).toBe(403);
  });

  it('records onboarding progress monotonically and persists step data', async () => {
    await resetOnboarding();

    const step1 = await owner()
      .patch('/api/v1/clinics/me/onboarding-step')
      .send({ step: 1, data: { name: 'Sunrise Clinic' } });
    expect(step1.status).toBe(200);
    expect(step1.body.data.onboardingStep).toBe(2);
    expect(step1.body.data.onboardingData.step1).toEqual({ name: 'Sunrise Clinic' });

    const step5 = await owner().patch('/api/v1/clinics/me/onboarding-step').send({ step: 5 });
    expect(step5.body.data.onboardingStep).toBe(6);

    // Re-saving an earlier step must never move progress backward.
    const backfill = await owner().patch('/api/v1/clinics/me/onboarding-step').send({ step: 1 });
    expect(backfill.status).toBe(200);
    expect(backfill.body.data.onboardingStep).toBe(6);
  });

  it('rejects an out-of-range onboarding step with 400', async () => {
    const res = await owner().patch('/api/v1/clinics/me/onboarding-step').send({ step: 0 });

    expect(res.status).toBe(400);
  });

  it('refuses activation until all onboarding steps are recorded', async () => {
    await resetOnboarding();

    const res = await owner().post('/api/v1/clinics/me/activate').send({});

    expect(res.status).toBe(409);
  });

  it('activates the clinic once onboarding reaches the review step, and is idempotent', async () => {
    await resetOnboarding();
    for (const step of [1, 2, 3, 4, 5, 6, 7, 8]) {
      await owner().patch('/api/v1/clinics/me/onboarding-step').send({ step });
    }

    const res = await owner().post('/api/v1/clinics/me/activate').send({});
    expect(res.status).toBe(200);
    expect(res.body.data.onboardingComplete).toBe(true);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.activatedAt).toBeTruthy();

    const auditEntry = await AuditLogModel.findOne({
      clinicId: clinic.clinicId,
      action: 'clinic.activate',
    }).lean();
    expect(auditEntry).not.toBeNull();

    const again = await owner().post('/api/v1/clinics/me/activate').send({});
    expect(again.status).toBe(200);
    expect(again.body.data.onboardingComplete).toBe(true);
  });

  it('refuses to activate a clinic with no active branch even if onboardingStep claims completion', async () => {
    await resetOnboarding();
    for (const step of [1, 2, 3, 4, 5, 6, 7, 8]) {
      await owner().patch('/api/v1/clinics/me/onboarding-step').send({ step });
    }
    // onboardingStep is a client-reported counter, not proof of real setup — simulate
    // a clinic that jumped straight to the review step with no usable branch.
    await BranchModel.updateMany({ clinicId: clinic.clinicId }, { $set: { isActive: false } });

    const res = await owner().post('/api/v1/clinics/me/activate').send({});
    expect(res.status).toBe(409);
  });

  it('refuses to activate a clinic with no active owner', async () => {
    await resetOnboarding();
    for (const step of [1, 2, 3, 4, 5, 6, 7, 8]) {
      await owner().patch('/api/v1/clinics/me/onboarding-step').send({ step });
    }
    // A clinic_owner's own membership must be active for them to call this endpoint
    // at all (tenantContext), so exercise the "zero active owners" branch as an
    // admin (who also holds onboarding.manage) after deactivating the sole owner.
    await MembershipModel.updateMany(
      { clinicId: clinic.clinicId, roleKey: 'clinic_owner' },
      { $set: { isActive: false } },
    );

    const res = await authed(clinic.app, clinic.tokens.clinic_admin)
      .post('/api/v1/clinics/me/activate')
      .send({});
    expect(res.status).toBe(409);
  });

  it('isolates tenants: clinic A updates never leak into clinic B', async () => {
    const clinicB = await createTestClinic('Other Clinic');

    const renamed = await owner().patch('/api/v1/clinics/me').send({ name: 'Clinic A Renamed' });
    expect(renamed.status).toBe(200);

    const resB = await authed(clinicB.app, clinicB.tokens.clinic_owner).get('/api/v1/clinics/me');
    expect(resB.status).toBe(200);
    expect(resB.body.data.id).toBe(clinicB.clinicId.toString());
    expect(resB.body.data.id).not.toBe(clinic.clinicId.toString());
    expect(resB.body.data.name).not.toBe('Clinic A Renamed');
  });
});
