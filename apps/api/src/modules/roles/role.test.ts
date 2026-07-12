import { describe, expect, it, beforeEach } from 'vitest';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from '@clinicos/types';
import { authed, createTestClinic, type TestClinic } from '../../test/helpers';
import { RoleModel } from './role.model';
import { MembershipModel } from '../memberships/membership.model';

describe('roles module', () => {
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

  async function roleIdByKey(key: string): Promise<string> {
    const res = await owner().get('/api/v1/roles');
    const role = (res.body.data as Array<{ id: string; key: string }>).find((r) => r.key === key);
    if (!role) throw new Error(`role ${key} missing from list`);
    return role.id;
  }

  it('lists the five system roles with their effective permissions', async () => {
    const res = await owner().get('/api/v1/roles');

    expect(res.status).toBe(200);
    const roles = res.body.data as Array<{
      id: string;
      key: string;
      name: string;
      permissions: string[];
      isSystem: boolean;
    }>;
    const keys = roles.map((r) => r.key);
    for (const key of ['clinic_owner', 'clinic_admin', 'doctor', 'nurse', 'receptionist']) {
      expect(keys).toContain(key);
    }

    const ownerRole = roles.find((r) => r.key === 'clinic_owner')!;
    expect(ownerRole.isSystem).toBe(true);
    expect([...ownerRole.permissions].sort()).toEqual([...ALL_PERMISSIONS].sort());

    const doctorRole = roles.find((r) => r.key === 'doctor')!;
    expect([...doctorRole.permissions].sort()).toEqual(
      [...DEFAULT_ROLE_PERMISSIONS.doctor].sort(),
    );
    expect(doctorRole.permissions).not.toContain(PERMISSIONS.ROLE_MANAGE);
  });

  it('serves the full permissions catalog with labels and domain groups', async () => {
    const res = await owner().get('/api/v1/roles/permissions-catalog');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(ALL_PERMISSIONS.length);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        { key: 'patient.read.basic', label: 'Read basic', group: 'patient', groupLabel: 'Patients' },
        { key: 'role.manage', label: 'Manage', group: 'role', groupLabel: 'Roles' },
      ]),
    );
  });

  it('updates a system role permission override with a reason and applies it to authorization', async () => {
    const receptionistRoleId = await roleIdByKey('receptionist');
    const permissions = [
      ...DEFAULT_ROLE_PERMISSIONS.receptionist,
      PERMISSIONS.ROLE_MANAGE,
    ];

    const res = await owner().patch(`/api/v1/roles/${receptionistRoleId}`).send({
      permissions,
      reason: 'Front desk lead now manages roles.',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.permissions).toContain(PERMISSIONS.ROLE_MANAGE);
    expect(res.body.data.isSystem).toBe(true);

    // authorize() resolves permissions from RoleModel, so the override takes effect
    // immediately: the receptionist can now perform a role.manage-gated mutation.
    const asReceptionist = await receptionist().post('/api/v1/roles').send({
      name: 'Filing Assistant',
      permissions: [PERMISSIONS.DOCUMENT_READ],
    });
    expect(asReceptionist.status).toBe(201);
  });

  it('rejects a permission update without a reason', async () => {
    const nurseRoleId = await roleIdByKey('nurse');

    const res = await owner().patch(`/api/v1/roles/${nurseRoleId}`).send({
      permissions: [...DEFAULT_ROLE_PERMISSIONS.nurse],
    });

    expect(res.status).toBe(400);
  });

  it('rejects permissions outside the canonical catalog', async () => {
    const nurseRoleId = await roleIdByKey('nurse');

    const res = await owner().patch(`/api/v1/roles/${nurseRoleId}`).send({
      permissions: ['not.a.permission'],
      reason: 'Testing invalid permission.',
    });

    expect(res.status).toBe(400);
  });

  it('refuses to reduce clinic owner permissions', async () => {
    const ownerRoleId = await roleIdByKey('clinic_owner');

    const res = await owner().patch(`/api/v1/roles/${ownerRoleId}`).send({
      permissions: [PERMISSIONS.DASHBOARD_VIEW],
      reason: 'Attempting to lock out the owner.',
    });

    expect(res.status).toBe(409);

    const after = await owner().get('/api/v1/roles');
    const ownerRole = (after.body.data as Array<{ key: string; permissions: string[] }>).find(
      (r) => r.key === 'clinic_owner',
    )!;
    expect([...ownerRole.permissions].sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it('creates a custom role with a derived key', async () => {
    const res = await owner().post('/api/v1/roles').send({
      name: 'Billing Clerk',
      description: 'Handles invoices and payments only.',
      permissions: [PERMISSIONS.BILLING_CREATE, PERMISSIONS.BILLING_READ],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.key).toBe('billing_clerk');
    expect(res.body.data.isSystem).toBe(false);
    expect(res.body.data.permissions).toEqual([
      PERMISSIONS.BILLING_CREATE,
      PERMISSIONS.BILLING_READ,
    ]);

    const list = await owner().get('/api/v1/roles');
    const keys = (list.body.data as Array<{ key: string }>).map((r) => r.key);
    expect(keys).toContain('billing_clerk');
  });

  it('rejects a custom role that shadows a reserved system key', async () => {
    const res = await owner().post('/api/v1/roles').send({
      name: 'Doctor',
      permissions: [PERMISSIONS.PATIENT_READ_BASIC],
    });

    expect(res.status).toBe(409);
  });

  it('cannot delete a system role', async () => {
    const doctorRoleId = await roleIdByKey('doctor');

    const res = await owner().delete(`/api/v1/roles/${doctorRoleId}`).send({});

    expect(res.status).toBe(409);
  });

  it('soft-deletes a custom role and removes it from the list', async () => {
    const createRes = await owner().post('/api/v1/roles').send({
      name: 'Temp Auditor',
      permissions: [PERMISSIONS.AUDIT_VIEW],
    });
    const roleId = createRes.body.data.id as string;

    const res = await owner().delete(`/api/v1/roles/${roleId}`).send({ reason: 'No longer needed.' });

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);

    const list = await owner().get('/api/v1/roles');
    const ids = (list.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(ids).not.toContain(roleId);

    // Soft delete only — the document survives with deletedAt set.
    const doc = await RoleModel.findById(roleId).lean();
    expect(doc).not.toBeNull();
    expect(doc!.deletedAt).toBeInstanceOf(Date);
  });

  it('refuses to delete a custom role still held by a deactivated (but reactivatable) staffer', async () => {
    const createRes = await owner().post('/api/v1/roles').send({
      name: 'Billing Clerk',
      permissions: [PERMISSIONS.BILLING_CREATE, PERMISSIONS.BILLING_READ],
    });
    const roleId = createRes.body.data.id as string;

    // Staff invite/update only accepts system role keys, so simulate a deactivated
    // holder of a custom role directly (a reactivation flow the API does support —
    // PATCH /staff/:id { isActive: true } never re-validates the roleId/roleKey).
    await MembershipModel.updateOne(
      { userId: clinic.userIds.receptionist, clinicId: clinic.clinicId },
      { $set: { roleId, roleKey: 'billing_clerk', isActive: false } as Record<string, unknown> },
    );

    const res = await owner().delete(`/api/v1/roles/${roleId}`).send({ reason: 'Cleaning up.' });
    expect(res.status).toBe(409);
  });

  it('forbids role mutations for a role without role.manage permission', async () => {
    const nurseRoleId = await roleIdByKey('nurse');

    const patchRes = await receptionist().patch(`/api/v1/roles/${nurseRoleId}`).send({
      permissions: [...DEFAULT_ROLE_PERMISSIONS.nurse],
      reason: 'Should not be allowed.',
    });
    expect(patchRes.status).toBe(403);

    const postRes = await authed(clinic.app, clinic.tokens.nurse).post('/api/v1/roles').send({
      name: 'Sneaky Role',
      permissions: [PERMISSIONS.PATIENT_READ_BASIC],
    });
    expect(postRes.status).toBe(403);
  });

  it('isolates roles between clinics', async () => {
    const clinicB = await createTestClinic('Other Clinic');
    const clinicARoleId = await roleIdByKey('receptionist');

    // Clinic B cannot see clinic A's role documents.
    const listB = await authed(clinicB.app, clinicB.tokens.clinic_owner).get('/api/v1/roles');
    expect(listB.status).toBe(200);
    const idsB = (listB.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(idsB).not.toContain(clinicARoleId);

    // Clinic B cannot mutate clinic A's role.
    const patchRes = await authed(clinicB.app, clinicB.tokens.clinic_owner)
      .patch(`/api/v1/roles/${clinicARoleId}`)
      .send({
        permissions: [PERMISSIONS.PATIENT_READ_BASIC],
        reason: 'Cross-tenant attack attempt.',
      });
    expect(patchRes.status).toBe(404);

    // Clinic A's role is untouched.
    const after = await owner().get('/api/v1/roles');
    const receptionistRole = (after.body.data as Array<{ id: string; permissions: string[] }>).find(
      (r) => r.id === clinicARoleId,
    )!;
    expect([...receptionistRole.permissions].sort()).toEqual(
      [...DEFAULT_ROLE_PERMISSIONS.receptionist].sort(),
    );
  });
});
