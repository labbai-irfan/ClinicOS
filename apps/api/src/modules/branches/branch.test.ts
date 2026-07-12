import { describe, expect, it, beforeEach } from 'vitest';
import { authed, createTestClinic, type TestClinic } from '../../test/helpers';
import { MembershipModel } from '../memberships/membership.model';

const WORKING_HOURS = [
  { day: 'monday', open: '09:00', close: '18:00', closed: false },
  { day: 'sunday', open: '09:00', close: '18:00', closed: true },
];

describe('branches module', () => {
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

  it('lists the clinic branches including the seeded Main Branch', async () => {
    const res = await receptionist().get('/api/v1/branches');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(clinic.branchId.toString());
    expect(res.body.data[0].clinicId).toBe(clinic.clinicId.toString());
    expect(res.body.data[0].name).toBe('Main Branch');
    expect(res.body.data[0].isActive).toBe(true);
    expect(Array.isArray(res.body.data[0].workingHours)).toBe(true);
  });

  it('creates a branch with address and working hours', async () => {
    const res = await owner().post('/api/v1/branches').send({
      name: 'East Wing',
      addressLine1: '12 MG Road',
      city: 'Pune',
      state: 'MH',
      postalCode: '411001',
      phone: '9876543210',
      workingHours: WORKING_HOURS,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('East Wing');
    expect(res.body.data.city).toBe('Pune');
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.workingHours).toEqual(WORKING_HOURS);

    const listRes = await owner().get('/api/v1/branches');
    expect(listRes.body.data).toHaveLength(2);
  });

  it('updates branch name, address, phone and working hours', async () => {
    const branchId = clinic.branchId.toString();

    const res = await owner().patch(`/api/v1/branches/${branchId}`).send({
      name: 'Main Branch (Renamed)',
      addressLine1: '5 Station Road',
      phone: '9000011111',
      workingHours: WORKING_HOURS,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(branchId);
    expect(res.body.data.name).toBe('Main Branch (Renamed)');
    expect(res.body.data.addressLine1).toBe('5 Station Road');
    expect(res.body.data.phone).toBe('9000011111');
    expect(res.body.data.workingHours).toEqual(WORKING_HOURS);

    const listRes = await owner().get('/api/v1/branches');
    expect(listRes.body.data[0].name).toBe('Main Branch (Renamed)');
  });

  it('rejects an invalid create payload with 400', async () => {
    const res = await owner().post('/api/v1/branches').send({
      // name missing
      city: 'Pune',
      workingHours: [{ day: 'notaday', open: '9', close: '18:00', closed: false }],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('forbids branch mutations for a role without settings.manage', async () => {
    const createRes = await receptionist().post('/api/v1/branches').send({ name: 'Sneaky Branch' });
    expect(createRes.status).toBe(403);

    const patchRes = await receptionist()
      .patch(`/api/v1/branches/${clinic.branchId.toString()}`)
      .send({ name: 'Sneaky Rename' });
    expect(patchRes.status).toBe(403);

    const deleteRes = await receptionist().delete(`/api/v1/branches/${clinic.branchId.toString()}`);
    expect(deleteRes.status).toBe(403);
  });

  it('isolates branches between clinics', async () => {
    const clinicB = await createTestClinic('Other Clinic');
    const ownerB = authed(clinicB.app, clinicB.tokens.clinic_owner);
    await ownerB.post('/api/v1/branches').send({ name: 'Clinic B Annex' });

    // Clinic A sees only its own branch.
    const listA = await owner().get('/api/v1/branches');
    expect(listA.status).toBe(200);
    expect(listA.body.data).toHaveLength(1);
    expect(listA.body.data[0].id).toBe(clinic.branchId.toString());

    // Clinic A cannot update or deactivate clinic B's branch.
    const foreignId = clinicB.branchId.toString();
    const patchRes = await owner().patch(`/api/v1/branches/${foreignId}`).send({ name: 'Hijacked' });
    expect(patchRes.status).toBe(404);

    const deleteRes = await owner().delete(`/api/v1/branches/${foreignId}`);
    expect(deleteRes.status).toBe(404);

    const listB = await ownerB.get('/api/v1/branches');
    expect(listB.body.data.map((b: { name: string }) => b.name)).toContain('Clinic B Annex');
    expect(listB.body.data.map((b: { name: string }) => b.name)).not.toContain('Hijacked');
  });

  it('refuses to deactivate the last active branch', async () => {
    const res = await owner().delete(`/api/v1/branches/${clinic.branchId.toString()}`);

    expect(res.status).toBe(409);

    const listRes = await owner().get('/api/v1/branches');
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].isActive).toBe(true);
  });

  it('soft-deactivates a branch when another active branch remains', async () => {
    const createRes = await owner().post('/api/v1/branches').send({ name: 'Second Branch' });
    const secondId = createRes.body.data.id as string;

    const res = await owner().delete(`/api/v1/branches/${secondId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(secondId);
    expect(res.body.data.isActive).toBe(false);

    // Soft-deleted: gone from the list, and the remaining branch is now protected.
    const listRes = await owner().get('/api/v1/branches');
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].id).toBe(clinic.branchId.toString());

    const again = await owner().delete(`/api/v1/branches/${secondId}`);
    expect(again.status).toBe(404);

    const lastOne = await owner().delete(`/api/v1/branches/${clinic.branchId.toString()}`);
    expect(lastOne.status).toBe(409);
  });

  it('strips a deactivated branch from every membership that listed it', async () => {
    const createRes = await owner().post('/api/v1/branches').send({ name: 'Second Branch' });
    const secondId = createRes.body.data.id as string;

    await MembershipModel.updateOne(
      { userId: clinic.userIds.receptionist, clinicId: clinic.clinicId },
      { $addToSet: { branchIds: secondId } },
    );
    const before = await MembershipModel.findOne({
      userId: clinic.userIds.receptionist,
      clinicId: clinic.clinicId,
    }).lean();
    expect(before!.branchIds.map((b) => b.toString())).toContain(secondId);

    const res = await owner().delete(`/api/v1/branches/${secondId}`);
    expect(res.status).toBe(200);

    const after = await MembershipModel.findOne({
      userId: clinic.userIds.receptionist,
      clinicId: clinic.clinicId,
    }).lean();
    expect(after!.branchIds.map((b) => b.toString())).not.toContain(secondId);
    // The receptionist still has their original branch — access isn't fully revoked.
    expect(after!.branchIds.map((b) => b.toString())).toContain(clinic.branchId.toString());
  });
});
