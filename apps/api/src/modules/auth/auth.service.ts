import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { DEFAULT_ROLE_PERMISSIONS, ERROR_CODES, ROLE_KEYS, type RoleKey } from '@clinicos/types';
import { env } from '../../config/env';
import { AppError, ConflictError, UnauthenticatedError } from '../../shared/errors';
import { signAccessToken } from '../../middleware/authenticate';
import { UserModel, type UserDoc } from '../users/user.model';
import { SessionModel } from './session.model';
import { OrganizationModel } from '../organizations/organization.model';
import { ClinicModel } from '../clinics/clinic.model';
import { BranchModel } from '../branches/branch.model';
import { RoleModel } from '../roles/role.model';
import { MembershipModel } from '../memberships/membership.model';
import { logger } from '../../shared/logger';

const BCRYPT_ROUNDS = 12;

interface RefreshTokenPayload {
  sub: string;
  sid: string;
  fid: string;
  type: 'refresh';
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function refreshTtlMs(): number {
  const m = /^(\d+)([smhd])$/.exec(env.REFRESH_TOKEN_TTL);
  if (!m) return 30 * 24 * 3600 * 1000;
  const value = Number(m[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd'];
  return value * unit;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: Types.ObjectId;
}

async function issueSession(user: UserDoc, client: ClientInfo, familyId?: string): Promise<IssuedTokens> {
  const sessionId = new Types.ObjectId();
  const fid = familyId ?? randomUUID();
  const payload: RefreshTokenPayload = {
    sub: user._id.toString(),
    sid: sessionId.toString(),
    fid,
    type: 'refresh',
  };
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
  await SessionModel.create({
    _id: sessionId,
    userId: user._id,
    familyId: fid,
    refreshTokenHash: hashToken(refreshToken),
    ip: client.ip,
    userAgent: client.userAgent,
    expiresAt: new Date(Date.now() + refreshTtlMs()),
    lastUsedAt: new Date(),
  });
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    sid: sessionId.toString(),
    email: user.email,
    name: user.name,
  });
  return { accessToken, refreshToken, sessionId };
}

export async function login(
  email: string,
  password: string,
  client: ClientInfo,
): Promise<{ user: UserDoc; tokens: IssuedTokens }> {
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  const invalid = new UnauthenticatedError('Incorrect email or password.');

  if (!user || !user.isActive) throw invalid;

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new AppError(
      423,
      ERROR_CODES.ACCOUNT_LOCKED,
      `Account is temporarily locked. Try again in ${minutes} minute(s).`,
    );
  }

  const okPassword = await bcrypt.compare(password, user.passwordHash);
  if (!okPassword) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= env.LOCKOUT_MAX_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + env.LOCKOUT_DURATION_MINUTES * 60_000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    throw invalid;
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueSession(user, client);
  return { user, tokens };
}

export async function rotateRefreshToken(
  refreshToken: string,
  client: ClientInfo,
): Promise<{ user: UserDoc; tokens: IssuedTokens }> {
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    if (payload.type !== 'refresh') throw new Error('wrong type');
  } catch {
    throw new UnauthenticatedError('Session expired. Please sign in again.');
  }

  const session = await SessionModel.findById(payload.sid);
  if (!session) throw new UnauthenticatedError('Session expired. Please sign in again.');

  const presentedHash = hashToken(refreshToken);
  if (session.revokedAt || session.refreshTokenHash !== presentedHash) {
    // Reuse of a rotated/revoked token → revoke the entire family.
    await SessionModel.updateMany(
      { familyId: session.familyId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'refresh token reuse detected' } },
    );
    logger.warn({ userId: session.userId.toString() }, 'refresh token reuse detected');
    throw new UnauthenticatedError('Session expired. Please sign in again.', ERROR_CODES.TOKEN_REUSED);
  }

  const user = await UserModel.findById(session.userId);
  if (!user || !user.isActive) throw new UnauthenticatedError();

  session.revokedAt = new Date();
  session.revokedReason = 'rotated';
  await session.save();

  const tokens = await issueSession(user, client, session.familyId);
  return { user, tokens };
}

export async function logout(sessionId: Types.ObjectId): Promise<void> {
  await SessionModel.updateOne(
    { _id: sessionId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: 'logout' } },
  );
}

export async function logoutAll(userId: Types.ObjectId): Promise<number> {
  const result = await SessionModel.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: 'logout all devices' } },
  );
  return result.modifiedCount;
}

export async function changePassword(
  userId: Types.ObjectId,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw new UnauthenticatedError();
  const okPassword = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!okPassword) throw new UnauthenticatedError('Current password is incorrect.');
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.mustChangePassword = false;
  await user.save();
  await logoutAll(userId);
}

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user || !user.isActive) return null; // do not reveal existence
  const token = randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60_000);
  await user.save();
  return token;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const user = await UserModel.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordHash +passwordResetTokenHash');
  if (!user) throw new UnauthenticatedError('This reset link is invalid or has expired.');
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  user.mustChangePassword = false;
  await user.save();
  await logoutAll(user._id);
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'clinic'
  );
}

/** Creates organization + clinic + main branch + seeded system roles + owner membership. */
export async function registerOwner(input: {
  name: string;
  email: string;
  password: string;
  clinicName: string;
  client: ClientInfo;
}): Promise<{ user: UserDoc; tokens: IssuedTokens }> {
  const existing = await UserModel.findOne({ email: input.email.toLowerCase() }).lean();
  if (existing) throw new ConflictError('An account with this email already exists.');

  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
  });
  const organization = await OrganizationModel.create({
    name: input.clinicName,
    ownerUserId: user._id,
  });
  const clinic = await ClinicModel.create({
    organizationId: organization._id,
    name: input.clinicName,
    slug: `${slugify(input.clinicName)}-${randomBytes(3).toString('hex')}`,
  });
  const branch = await BranchModel.create({
    organizationId: organization._id,
    clinicId: clinic._id,
    name: 'Main Branch',
  });

  const roleDocs = await RoleModel.insertMany(
    ROLE_KEYS.filter((k) => k !== 'super_admin' && k !== 'patient').map((key: RoleKey) => ({
      organizationId: organization._id,
      clinicId: clinic._id,
      key,
      name: key
        .split('_')
        .map((w) => w[0]!.toUpperCase() + w.slice(1))
        .join(' '),
      permissions: [...DEFAULT_ROLE_PERMISSIONS[key]],
      isSystem: true,
    })),
  );
  const ownerRole = roleDocs.find((r) => r.key === 'clinic_owner');
  if (!ownerRole) throw new Error('owner role seed failed');

  await MembershipModel.create({
    userId: user._id,
    organizationId: organization._id,
    clinicId: clinic._id,
    roleId: ownerRole._id,
    roleKey: 'clinic_owner',
    branchIds: [branch._id],
  });

  const tokens = await issueSession(user, input.client);
  return { user, tokens };
}

export async function listActiveSessions(userId: Types.ObjectId) {
  return SessionModel.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .select('ip userAgent createdAt lastUsedAt')
    .lean();
}
