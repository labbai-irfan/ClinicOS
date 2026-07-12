import { describe, expect, it, beforeEach } from 'vitest';
import type { StaffDto } from '@clinicos/types';
import { authed, createTestClinic, type TestClinic } from '../../test/helpers';

let inviteCounter = 0;

function invitePayload(clinic: TestClinic, overrides: Record<string, unknown> = {}) {
  inviteCounter += 1;
  return {
    name: 'Dr. Kavya Menon',
    email: `kavya-${inviteCounter}-${Date.now()}@test.dev`,
    roleKey: 'doctor',
    branchIds: [clinic.branchId.toString()],
    specialization: 'Pediatrics',
    qualification: 'MBBS, MD',
    registrationNumber: 'KMC-12345',
    consultationFeePaise: 50000,
    followUpFeePaise: 20000,
    ...overrides,
  };
}

describe('staff module', () => {
  let clinic: TestClinic;

  beforeEach(async () => {
    clinic = await createTestClinic();
  });

  function owner() {
    return authed(clinic.app, clinic.tokens.clinic_owner);
  }

  async function findStaffByRole(roleKey: string): Promise<StaffDto> {
    const res = await owner().get(`/api/v1/staff?roleKey=${roleKey}`);
    expect(res.status).toBe(200);
    const staff = (res.body.data as StaffDto[]).find((s) => s.roleKey === roleKey);
    if (!staff) throw new Error(`no staff row for role ${roleKey}`);
    return staff;
  }

  it('lists all clinic staff joined with user identity and membership', async () => {
    const res = await owner().get('/api/v1/staff');

    expect(res.status).toBe(200);
    // createTestClinic seeds one user per staff role (owner, admin, doctor, nurse, receptionist).
    expect(res.body.meta.total).toBe(5);
    const rows = res.body.data as StaffDto[];
    const ownerRow = rows.find((s) => s.roleKey === 'clinic_owner');
    expect(ownerRow).toBeDefined();
    expect(ownerRow?.name).toBe('Owner User');
    expect(ownerRow?.email).toContain('owner-');
    expect(ownerRow?.branchIds).toContain(clinic.branchId.toString());
    expect(ownerRow?.isActive).toBe(true);
    for (const row of rows) {
      expect(typeof row.id).toBe('string');
      expect(typeof row.userId).toBe('string');
    }
  });

  it('filters the list by roleKey, q and isActive', async () => {
    const byRole = await owner().get('/api/v1/staff?roleKey=doctor');
    expect(byRole.status).toBe(200);
    expect(byRole.body.data).toHaveLength(1);
    expect(byRole.body.data[0].roleKey).toBe('doctor');

    const byQ = await owner().get('/api/v1/staff?q=owner user');
    expect(byQ.status).toBe(200);
    expect(byQ.body.data).toHaveLength(1);
    expect(byQ.body.data[0].roleKey).toBe('clinic_owner');

    const active = await owner().get('/api/v1/staff?isActive=true');
    expect(active.status).toBe(200);
    expect(active.body.meta.total).toBe(5);

    const inactive = await owner().get('/api/v1/staff?isActive=false');
    expect(inactive.status).toBe(200);
    expect(inactive.body.meta.total).toBe(0);
  });

  it('invites a doctor: creates user + membership + staff profile with fee fields', async () => {
    const payload = invitePayload(clinic);
    const res = await owner().post('/api/v1/staff').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Dr. Kavya Menon');
    expect(res.body.data.email).toBe(payload.email);
    expect(res.body.data.roleKey).toBe('doctor');
    expect(res.body.data.branchIds).toEqual([clinic.branchId.toString()]);
    expect(res.body.data.specialization).toBe('Pediatrics');
    expect(res.body.data.qualification).toBe('MBBS, MD');
    expect(res.body.data.registrationNumber).toBe('KMC-12345');
    expect(res.body.data.consultationFeePaise).toBe(50000);
    expect(res.body.data.followUpFeePaise).toBe(20000);
    expect(res.body.data.isActive).toBe(true);

    const list = await owner().get('/api/v1/staff');
    expect(list.body.meta.total).toBe(6);
  });

  it('rejects inviting the same email twice into the same clinic', async () => {
    const payload = invitePayload(clinic);
    const first = await owner().post('/api/v1/staff').send(payload);
    expect(first.status).toBe(201);

    const second = await owner().post('/api/v1/staff').send(payload);
    expect(second.status).toBe(409);
  });

  it('rejects inviting an email that already has an active membership at another clinic', async () => {
    const payload = invitePayload(clinic);
    const first = await owner().post('/api/v1/staff').send(payload);
    expect(first.status).toBe(201);

    // The tenant middleware resolves clinic access from a single active membership —
    // it has no way to represent (or let the user choose) one account active at two
    // clinics at once, so a second clinic inviting the same, still-active email must
    // be rejected explicitly rather than silently creating an unreachable membership.
    const otherClinic = await createTestClinic('Other Clinic');
    const res = await authed(otherClinic.app, otherClinic.tokens.clinic_owner)
      .post('/api/v1/staff')
      .send({ ...payload, branchIds: [otherClinic.branchId.toString()] });

    expect(res.status).toBe(409);
  });

  it('reuses an existing user account once their other-clinic membership is inactive', async () => {
    const payload = invitePayload(clinic);
    const first = await owner().post('/api/v1/staff').send(payload);
    expect(first.status).toBe(201);

    await owner().patch(`/api/v1/staff/${first.body.data.id}`).send({ isActive: false });

    const otherClinic = await createTestClinic('Other Clinic');
    const res = await authed(otherClinic.app, otherClinic.tokens.clinic_owner)
      .post('/api/v1/staff')
      .send({ ...payload, branchIds: [otherClinic.branchId.toString()] });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(payload.email);
    expect(res.body.data.userId).toBe(first.body.data.userId);
  });

  it('returns a generated temporary password only when the caller did not supply one', async () => {
    const withoutPassword = await owner().post('/api/v1/staff').send(invitePayload(clinic));
    expect(withoutPassword.status).toBe(201);
    expect(typeof withoutPassword.body.data.temporaryPassword).toBe('string');
    expect(withoutPassword.body.data.temporaryPassword.length).toBeGreaterThan(8);

    const withPassword = await owner()
      .post('/api/v1/staff')
      .send(invitePayload(clinic, { temporaryPassword: 'ChosenPass1' }));
    expect(withPassword.status).toBe(201);
    expect(withPassword.body.data.temporaryPassword).toBeUndefined();
  });

  it('rejects an invite with a branch belonging to another clinic', async () => {
    const otherClinic = await createTestClinic('Other Clinic');
    const res = await owner()
      .post('/api/v1/staff')
      .send(invitePayload(clinic, { branchIds: [otherClinic.branchId.toString()] }));

    expect(res.status).toBe(404);
  });

  it('rejects an invalid invite payload with 400', async () => {
    const noBranches = await owner()
      .post('/api/v1/staff')
      .send(invitePayload(clinic, { branchIds: [] }));
    expect(noBranches.status).toBe(400);

    const badEmail = await owner()
      .post('/api/v1/staff')
      .send(invitePayload(clinic, { email: 'not-an-email' }));
    expect(badEmail.status).toBe(400);

    const badRole = await owner()
      .post('/api/v1/staff')
      .send(invitePayload(clinic, { roleKey: 'super_admin' }));
    expect(badRole.status).toBe(400);
  });

  it('updates role, profile fields and fees via PATCH /staff/:id', async () => {
    const receptionist = await findStaffByRole('receptionist');

    const res = await owner().patch(`/api/v1/staff/${receptionist.id}`).send({
      name: 'Renamed Staffer',
      roleKey: 'nurse',
      qualification: 'GNM',
      consultationFeePaise: 15000,
      avgConsultationMinutes: 20,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(receptionist.id);
    expect(res.body.data.name).toBe('Renamed Staffer');
    expect(res.body.data.roleKey).toBe('nurse');
    expect(res.body.data.qualification).toBe('GNM');
    expect(res.body.data.consultationFeePaise).toBe(15000);
    expect(res.body.data.avgConsultationMinutes).toBe(20);
  });

  it('deactivates a staff member, blocking clinic access, and reactivates them', async () => {
    const receptionist = await findStaffByRole('receptionist');
    const receptionistApi = authed(clinic.app, clinic.tokens.receptionist);

    // Active member can reach tenant-scoped routes.
    const beforeDeactivate = await receptionistApi.get('/api/v1/staff');
    expect(beforeDeactivate.status).toBe(200);

    const deactivate = await owner().patch(`/api/v1/staff/${receptionist.id}`).send({ isActive: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.data.isActive).toBe(false);

    // Membership is now inactive → tenant context resolution rejects the user for this clinic.
    const blocked = await receptionistApi.get('/api/v1/staff');
    expect(blocked.status).toBe(403);

    const reactivate = await owner().patch(`/api/v1/staff/${receptionist.id}`).send({ isActive: true });
    expect(reactivate.status).toBe(200);
    expect(reactivate.body.data.isActive).toBe(true);

    const restored = await receptionistApi.get('/api/v1/staff');
    expect(restored.status).toBe(200);
  });

  it('refuses to deactivate or demote the last active clinic owner', async () => {
    const ownerRow = await findStaffByRole('clinic_owner');

    const deactivate = await owner().patch(`/api/v1/staff/${ownerRow.id}`).send({ isActive: false });
    expect(deactivate.status).toBe(409);

    const demote = await owner().patch(`/api/v1/staff/${ownerRow.id}`).send({ roleKey: 'doctor' });
    expect(demote.status).toBe(409);
  });

  it('forbids staff mutations for roles without staff.manage but allows directory reads', async () => {
    const doctorApi = authed(clinic.app, clinic.tokens.doctor);

    const read = await doctorApi.get('/api/v1/staff');
    expect(read.status).toBe(200);

    const inviteRes = await doctorApi.post('/api/v1/staff').send(invitePayload(clinic));
    expect(inviteRes.status).toBe(403);

    const receptionist = await findStaffByRole('receptionist');
    const patchRes = await doctorApi
      .patch(`/api/v1/staff/${receptionist.id}`)
      .send({ isActive: false });
    expect(patchRes.status).toBe(403);
  });

  it('forbids a clinic_admin from inviting a clinic_owner (privilege escalation)', async () => {
    const adminApi = authed(clinic.app, clinic.tokens.clinic_admin);

    const res = await adminApi.post('/api/v1/staff').send(invitePayload(clinic, { roleKey: 'clinic_owner' }));
    expect(res.status).toBe(403);
  });

  it('forbids a clinic_admin from promoting an existing staffer to clinic_owner', async () => {
    const adminApi = authed(clinic.app, clinic.tokens.clinic_admin);
    const receptionist = await findStaffByRole('receptionist');

    const res = await adminApi
      .patch(`/api/v1/staff/${receptionist.id}`)
      .send({ roleKey: 'clinic_owner' });
    expect(res.status).toBe(403);

    // Confirm the role genuinely never changed.
    const stillReceptionist = await owner().get(`/api/v1/staff?roleKey=receptionist`);
    expect(stillReceptionist.body.data.some((s: StaffDto) => s.id === receptionist.id)).toBe(true);
  });

  it('allows a clinic_owner (but not a clinic_admin) to grant the clinic_owner role', async () => {
    const receptionist = await findStaffByRole('receptionist');
    const res = await owner().patch(`/api/v1/staff/${receptionist.id}`).send({ roleKey: 'clinic_owner' });
    expect(res.status).toBe(200);
    expect(res.body.data.roleKey).toBe('clinic_owner');
  });

  it('blocks editing name/phone for a staffer who is also active at another clinic', async () => {
    const payload = invitePayload(clinic);
    const invited = await owner().post('/api/v1/staff').send(payload);
    expect(invited.status).toBe(201);

    const otherClinic = await createTestClinic('Other Clinic');
    // Deactivate here first so the cross-clinic invite in the other clinic succeeds,
    // then reactivate to simulate the staffer being active at both clinics.
    await owner().patch(`/api/v1/staff/${invited.body.data.id}`).send({ isActive: false });
    const otherInvite = await authed(otherClinic.app, otherClinic.tokens.clinic_owner)
      .post('/api/v1/staff')
      .send({ ...payload, branchIds: [otherClinic.branchId.toString()] });
    expect(otherInvite.status).toBe(201);
    await owner().patch(`/api/v1/staff/${invited.body.data.id}`).send({ isActive: true });

    const res = await owner()
      .patch(`/api/v1/staff/${invited.body.data.id}`)
      .send({ name: 'Renamed Elsewhere' });
    expect(res.status).toBe(409);
  });

  it('isolates staff between clinics', async () => {
    const clinicB = await createTestClinic('Clinic B');
    const ownerB = authed(clinicB.app, clinicB.tokens.clinic_owner);

    const listA = await owner().get('/api/v1/staff');
    const listB = await ownerB.get('/api/v1/staff');
    const emailsA = (listA.body.data as StaffDto[]).map((s) => s.email);
    const emailsB = (listB.body.data as StaffDto[]).map((s) => s.email);
    expect(emailsA.some((email) => emailsB.includes(email))).toBe(false);

    // Clinic B cannot mutate clinic A's staff row.
    const staffA = (listA.body.data as StaffDto[])[0]!;
    const res = await ownerB.patch(`/api/v1/staff/${staffA.id}`).send({ isActive: false });
    expect(res.status).toBe(404);
  });
});
