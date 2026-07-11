import type { Express } from 'express';
import request from 'supertest';
import type { RoleKey } from '@clinicos/types';
import { createApp } from '../app';
import * as authService from '../modules/auth/auth.service';
import { UserModel } from '../modules/users/user.model';
import { RoleModel } from '../modules/roles/role.model';
import { MembershipModel } from '../modules/memberships/membership.model';
import { BranchModel } from '../modules/branches/branch.model';
import { ClinicModel } from '../modules/clinics/clinic.model';
import { signAccessToken } from '../middleware/authenticate';
import { Types } from 'mongoose';

export interface TestClinic {
  app: Express;
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  branchId: Types.ObjectId;
  tokens: Record<Exclude<RoleKey, 'super_admin' | 'patient'>, string>;
  userIds: Record<Exclude<RoleKey, 'super_admin' | 'patient'>, Types.ObjectId>;
}

let counter = 0;

/**
 * Seeds an organization + clinic + branch + system roles and one user per staff role.
 * Returns ready-to-use Bearer tokens for each role.
 */
export async function createTestClinic(name = 'Test Clinic'): Promise<TestClinic> {
  counter += 1;
  const app = createApp();
  const owner = await authService.registerOwner({
    name: 'Owner User',
    email: `owner-${counter}-${Date.now()}@test.dev`,
    password: 'Password1',
    clinicName: `${name} ${counter}`,
    client: {},
  });

  const membership = await MembershipModel.findOne({ userId: owner.user._id }).lean();
  if (!membership) throw new Error('seed failed: owner membership missing');
  const { organizationId, clinicId } = membership;
  const branch = await BranchModel.findOne({ clinicId }).lean();
  if (!branch) throw new Error('seed failed: branch missing');
  await ClinicModel.updateOne({ _id: clinicId }, { $set: { onboardingComplete: true } });

  const roleKeys = ['clinic_owner', 'clinic_admin', 'doctor', 'nurse', 'receptionist'] as const;
  const tokens = {} as TestClinic['tokens'];
  const userIds = {} as TestClinic['userIds'];

  for (const roleKey of roleKeys) {
    let userId = owner.user._id;
    if (roleKey !== 'clinic_owner') {
      const role = await RoleModel.findOne({ clinicId, key: roleKey }).lean();
      if (!role) throw new Error(`seed failed: role ${roleKey} missing`);
      const user = await UserModel.create({
        name: `${roleKey} user`,
        email: `${roleKey}-${counter}-${Date.now()}@test.dev`,
        passwordHash: await authService.hashPassword('Password1'),
      });
      await MembershipModel.create({
        userId: user._id,
        organizationId,
        clinicId,
        roleId: role._id,
        roleKey,
        branchIds: [branch._id],
      });
      userId = user._id;
    }
    userIds[roleKey] = userId;
    tokens[roleKey] = signAccessToken({
      sub: userId.toString(),
      sid: new Types.ObjectId().toString(),
      email: `${roleKey}@test.dev`,
      name: `${roleKey} user`,
    });
  }

  return { app, organizationId, clinicId, branchId: branch._id, tokens, userIds };
}

export function authed(app: Express, token: string) {
  return {
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
  };
}
