import { randomBytes } from 'node:crypto';
import { Types, type HydratedDocument } from 'mongoose';
import type { Permission, RoleKey, StaffDto } from '@clinicos/types';
import type { InviteStaffInput, UpdateStaffInput } from '@clinicos/validation';
import type { Pagination } from '../../shared/pagination';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { hashPassword } from '../auth/auth.service';
import { UserModel, type UserDoc } from '../users/user.model';
import { MembershipModel, type MembershipDoc } from '../memberships/membership.model';
import { RoleModel, type RoleDoc } from '../roles/role.model';
import { BranchModel } from '../branches/branch.model';
import { StaffProfileModel, type StaffProfileDoc } from './staff.model';

/** Minimal tenant context a service function needs — never trust ids from client input. */
export interface TenantContext {
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  /** The caller's own role/permissions — used to stop privilege escalation via invite/update. */
  actorRoleKey: RoleKey;
  actorPermissions: ReadonlySet<Permission>;
}

/** True for Mongo/Mongoose duplicate-key errors (E11000) — used to translate races into 409s. */
function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Refuse to grant a role whose permissions exceed what the caller holds themselves
 * (spec: staff.manage must never be usable to self-escalate). Clinic owners hold
 * ALL_PERMISSIONS and may grant any role, including another owner; everyone else
 * (e.g. clinic_admin, who also holds staff.manage) may only grant roles that are a
 * subset of their own permissions — so an admin can never mint a clinic_owner or
 * hand out role.manage/audit.view they don't have.
 */
function assertCanAssignRole(tenant: TenantContext, role: Pick<RoleDoc, 'permissions'>): void {
  if (tenant.actorRoleKey === 'clinic_owner') return;
  const missing = role.permissions.filter((p) => !tenant.actorPermissions.has(p));
  if (missing.length > 0) {
    throw new ForbiddenError('You cannot grant a role with permissions you do not hold yourself.');
  }
}

export interface StaffListFilters {
  q?: string;
  roleKey?: RoleKey;
  branchId?: string;
  isActive?: boolean;
}

type ProfileLike = Pick<
  StaffProfileDoc,
  | '_id'
  | 'specialization'
  | 'qualification'
  | 'registrationNumber'
  | 'consultationFeePaise'
  | 'followUpFeePaise'
  | 'avgConsultationMinutes'
>;
type MembershipLike = Pick<MembershipDoc, 'roleKey' | 'branchIds' | 'isActive'>;
type UserLike = Pick<UserDoc, '_id' | 'name' | 'email' | 'phone'>;

/** Joined staff row: profile (staff-owned) + membership (role/branches/access) + user (identity). */
export function toStaffDto(profile: ProfileLike, membership: MembershipLike, user: UserLike): StaffDto {
  return {
    id: profile._id.toString(),
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    roleKey: membership.roleKey,
    branchIds: membership.branchIds.map((b) => b.toString()),
    specialization: profile.specialization,
    qualification: profile.qualification,
    registrationNumber: profile.registrationNumber,
    consultationFeePaise: profile.consultationFeePaise,
    followUpFeePaise: profile.followUpFeePaise,
    avgConsultationMinutes: profile.avgConsultationMinutes,
    // Membership is the source of truth for clinic access; profile.isActive mirrors it.
    isActive: membership.isActive,
  };
}

/** Verify every branch id belongs to the caller's own clinic (and is active). */
async function assertBranchesInClinic(tenant: TenantContext, branchIds: string[]): Promise<void> {
  const unique = [...new Set(branchIds)];
  const count = await BranchModel.countDocuments({
    _id: { $in: unique },
    clinicId: tenant.clinicId,
    isActive: true,
  });
  if (count !== unique.length) throw new NotFoundError('Branch');
}

/**
 * Get-or-create the staff profile for a clinic member. Owner accounts created at
 * registration (auth.registerOwner) have a membership but no profile yet — same
 * upsert-on-read pattern the settings module uses.
 */
async function getOrCreateProfile(
  tenant: TenantContext,
  userId: Types.ObjectId,
  roleKey: RoleKey,
): Promise<StaffProfileDoc> {
  const profile = await StaffProfileModel.findOneAndUpdate(
    { clinicId: tenant.clinicId, userId },
    {
      $setOnInsert: {
        organizationId: tenant.organizationId,
        clinicId: tenant.clinicId,
        userId,
        roleKey,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return profile;
}

/**
 * Staff directory: every membership of the clinic joined with its user identity and
 * staff profile. Filters are applied on the joined rows (clinic staff counts are small),
 * sorted by name for a stable listing.
 */
export async function listStaff(
  tenant: TenantContext,
  filters: StaffListFilters,
  pagination: Pagination,
): Promise<{ items: StaffDto[]; total: number }> {
  const memberships = await MembershipModel.find({ clinicId: tenant.clinicId }).lean();
  const userIds = memberships.map((m) => m.userId);

  const [users, profiles] = await Promise.all([
    UserModel.find({ _id: { $in: userIds } }).lean(),
    StaffProfileModel.find({ clinicId: tenant.clinicId, userId: { $in: userIds } }).lean(),
  ]);
  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const profileByUserId = new Map(profiles.map((p) => [p.userId.toString(), p]));

  const rows: StaffDto[] = [];
  for (const membership of memberships) {
    const user = userById.get(membership.userId.toString());
    if (!user) continue;
    const profile =
      profileByUserId.get(membership.userId.toString()) ??
      (await getOrCreateProfile(tenant, membership.userId, membership.roleKey));
    if (profile.deletedAt) continue;
    rows.push(toStaffDto(profile, membership, user));
  }

  const q = filters.q?.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (q && !row.name.toLowerCase().includes(q) && !row.email.toLowerCase().includes(q)) return false;
    if (filters.roleKey && row.roleKey !== filters.roleKey) return false;
    if (filters.branchId && !row.branchIds.includes(filters.branchId)) return false;
    if (filters.isActive !== undefined && row.isActive !== filters.isActive) return false;
    return true;
  });
  filtered.sort((a, b) => a.name.localeCompare(b.name));

  return {
    items: filtered.slice(pagination.skip, pagination.skip + pagination.limit),
    total: filtered.length,
  };
}

/**
 * Invite/create a staff member (spec §9): reuse an existing user account by email or
 * create one (temporary password, must change on first login), then create the clinic
 * membership (role + branches) and the staff profile.
 */
export async function inviteStaff(tenant: TenantContext, input: InviteStaffInput): Promise<StaffDto> {
  const role = await RoleModel.findOne({ clinicId: tenant.clinicId, key: input.roleKey }).lean();
  if (!role) throw new NotFoundError('Role');
  assertCanAssignRole(tenant, role);
  await assertBranchesInClinic(tenant, input.branchIds);

  const existing = await UserModel.findOne({ email: input.email });
  let user: UserDoc;
  let createdNewUser = false;
  // Returned once in the response below so the admin has a way to hand the new
  // staffer their credentials — there is no outbound invite email yet, and an
  // account with no known password and no delivery path is otherwise unreachable.
  let generatedTemporaryPassword: string | undefined;
  if (existing) {
    const existingMembership = await MembershipModel.findOne({
      userId: existing._id,
      clinicId: tenant.clinicId,
    }).lean();
    if (existingMembership) {
      throw new ConflictError('This email already belongs to a staff member of this clinic.');
    }
    // Users are global accounts; tenant access is resolved from a single active
    // membership (middleware/tenant.ts), which cannot represent one person working
    // at two clinics at once. Attaching this email here would create a membership
    // the person could never actually reach — reject explicitly instead.
    const otherActiveMembership = await MembershipModel.exists({
      userId: existing._id,
      clinicId: { $ne: tenant.clinicId },
      isActive: true,
    });
    if (otherActiveMembership) {
      throw new ConflictError(
        'This email already belongs to an active staff member at another clinic and cannot be invited here.',
      );
    }
    user = existing.toObject();
  } else {
    generatedTemporaryPassword = input.temporaryPassword ?? randomBytes(18).toString('base64url');
    const createdUser = await UserModel.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(generatedTemporaryPassword),
      mustChangePassword: true,
    });
    user = createdUser.toObject();
    createdNewUser = true;
    // Only surface it in the response when we picked it ourselves — if the admin
    // supplied their own, they already know it.
    if (input.temporaryPassword !== undefined) generatedTemporaryPassword = undefined;
  }

  // The three writes below are not covered by a transaction (no replica set in this
  // deployment target) — compensate manually so a mid-flight failure never leaves an
  // orphaned User account occupying the (globally unique) email with no membership.
  let membership: HydratedDocument<MembershipDoc>;
  try {
    membership = await MembershipModel.create({
      userId: user._id,
      organizationId: tenant.organizationId,
      clinicId: tenant.clinicId,
      roleId: role._id,
      roleKey: input.roleKey,
      branchIds: input.branchIds.map((id) => new Types.ObjectId(id)),
    });
  } catch (err) {
    if (createdNewUser) await UserModel.deleteOne({ _id: user._id }).catch(() => undefined);
    if (isDuplicateKeyError(err)) {
      throw new ConflictError('This email already belongs to a staff member of this clinic.');
    }
    throw err;
  }

  let profile: StaffProfileDoc;
  try {
    profile = await StaffProfileModel.findOneAndUpdate(
      { clinicId: tenant.clinicId, userId: user._id },
      {
        $set: {
          roleKey: input.roleKey,
          specialization: input.specialization,
          qualification: input.qualification,
          registrationNumber: input.registrationNumber,
          consultationFeePaise: input.consultationFeePaise,
          followUpFeePaise: input.followUpFeePaise,
          isActive: true,
          deletedAt: null,
        },
        $setOnInsert: {
          organizationId: tenant.organizationId,
          clinicId: tenant.clinicId,
          userId: user._id,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
  } catch (err) {
    await MembershipModel.deleteOne({ _id: membership._id }).catch(() => undefined);
    if (createdNewUser) await UserModel.deleteOne({ _id: user._id }).catch(() => undefined);
    throw err;
  }

  const dto = toStaffDto(profile, membership.toObject(), user);
  return generatedTemporaryPassword ? { ...dto, temporaryPassword: generatedTemporaryPassword } : dto;
}

/**
 * Update a staff member: identity (name/phone), role, branch assignments, profile/fee
 * fields, and activation. Deactivating (or demoting) the last active clinic owner is
 * blocked so the clinic can never lock itself out. Deactivation flips the membership,
 * which blocks clinic access at tenantContext resolution.
 */
export async function updateStaff(
  tenant: TenantContext,
  staffId: string,
  input: UpdateStaffInput,
): Promise<{ before: StaffDto; after: StaffDto }> {
  const profile = await StaffProfileModel.findOne({
    _id: staffId,
    clinicId: tenant.clinicId,
    deletedAt: null,
  });
  if (!profile) throw new NotFoundError('Staff member');

  const [membership, user] = await Promise.all([
    MembershipModel.findOne({ userId: profile.userId, clinicId: tenant.clinicId }),
    UserModel.findById(profile.userId),
  ]);
  if (!membership || !user) throw new NotFoundError('Staff member');

  const before = toStaffDto(profile.toObject(), membership.toObject(), user.toObject());

  // Resolve the target role up front (needed both for the privilege check and to
  // know whether this change would drop the clinic's last active owner).
  let targetRole: RoleDoc | null = null;
  if (input.roleKey !== undefined && input.roleKey !== membership.roleKey) {
    targetRole = await RoleModel.findOne({ clinicId: tenant.clinicId, key: input.roleKey }).lean();
    if (!targetRole) throw new NotFoundError('Role');
    assertCanAssignRole(tenant, targetRole);
  }

  const wasActiveOwner = membership.roleKey === 'clinic_owner' && membership.isActive;
  const losesOwner =
    wasActiveOwner &&
    ((input.roleKey !== undefined && input.roleKey !== 'clinic_owner') || input.isActive === false);

  if (losesOwner) {
    // Check-then-act on a single membership is racy across concurrent requests
    // demoting two different owners at once (no multi-document transactions in
    // this deployment). Guard against it with an optimistic claim: atomically flip
    // *this* membership's owner status first, then verify the invariant still
    // holds — rolling the flip back if it doesn't. Two concurrent "last owner"
    // demotions can therefore both safely fail closed instead of racing to zero.
    const claimSet: Partial<Pick<MembershipDoc, 'isActive' | 'roleKey' | 'roleId'>> = {};
    if (input.isActive === false) claimSet.isActive = false;
    if (targetRole) {
      claimSet.roleKey = input.roleKey;
      claimSet.roleId = targetRole._id;
    }
    const claimed = await MembershipModel.findOneAndUpdate(
      { _id: membership._id, isActive: true, roleKey: 'clinic_owner' },
      { $set: claimSet },
      { new: true },
    );
    if (!claimed) {
      throw new ConflictError('This staff record changed concurrently. Please retry.');
    }
    const otherActiveOwners = await MembershipModel.countDocuments({
      clinicId: tenant.clinicId,
      roleKey: 'clinic_owner',
      isActive: true,
      _id: { $ne: membership._id },
    });
    if (otherActiveOwners === 0) {
      await MembershipModel.updateOne(
        { _id: membership._id },
        { $set: { isActive: true, roleKey: 'clinic_owner', roleId: membership.roleId } },
      );
      throw new ConflictError('A clinic must keep at least one active clinic owner.');
    }
    // Sync the in-memory document so the rest of this function (branch/profile
    // fields, audit before/after) sees the already-committed owner transition
    // instead of re-deriving and re-saving it.
    membership.isActive = claimed.isActive;
    membership.roleKey = claimed.roleKey;
    membership.roleId = claimed.roleId;
    if (targetRole) profile.roleKey = input.roleKey!;
    if (input.isActive !== undefined) profile.isActive = input.isActive;
  }

  if (input.branchIds !== undefined) {
    await assertBranchesInClinic(tenant, input.branchIds);
    membership.branchIds = input.branchIds.map((id) => new Types.ObjectId(id));
  }
  if (!losesOwner && targetRole) {
    membership.roleId = targetRole._id;
    membership.roleKey = input.roleKey!;
    profile.roleKey = input.roleKey!;
  }
  if (!losesOwner && input.isActive !== undefined) {
    membership.isActive = input.isActive;
    profile.isActive = input.isActive;
  }
  if (input.name !== undefined || input.phone !== undefined) {
    // Users are a single global account shared across every clinic they belong to
    // (inviteStaff can attach the same email to more than one clinic over time).
    // Writing name/phone here would silently mutate identity fields another
    // clinic's directory, prescriptions and login also depend on — only allow it
    // when this is the person's only active clinic membership.
    const otherActiveMembership = await MembershipModel.exists({
      userId: user._id,
      clinicId: { $ne: tenant.clinicId },
      isActive: true,
    });
    if (otherActiveMembership) {
      throw new ConflictError(
        'This person is also active at another clinic; their name and phone are shared identity fields and cannot be edited here.',
      );
    }
  }
  if (input.name !== undefined) user.name = input.name;
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.specialization !== undefined) profile.specialization = input.specialization;
  if (input.qualification !== undefined) profile.qualification = input.qualification;
  if (input.registrationNumber !== undefined) profile.registrationNumber = input.registrationNumber;
  if (input.consultationFeePaise !== undefined) profile.consultationFeePaise = input.consultationFeePaise;
  if (input.followUpFeePaise !== undefined) profile.followUpFeePaise = input.followUpFeePaise;
  if (input.avgConsultationMinutes !== undefined) {
    profile.avgConsultationMinutes = input.avgConsultationMinutes;
  }

  await Promise.all([profile.save(), membership.save(), user.save()]);

  return { before, after: toStaffDto(profile.toObject(), membership.toObject(), user.toObject()) };
}
