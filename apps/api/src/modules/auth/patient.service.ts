import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { formatToken } from '@clinicos/config';
import { env } from '../../config/env';
import { AppError, ConflictError, UnauthenticatedError } from '../../shared/errors';
import { signAccessToken } from '../../middleware/authenticate';
import { UserModel, type UserDoc } from '../users/user.model';
import { ClinicModel } from '../clinics/clinic.model';
import { PatientModel } from '../patients/patient.model';
import { nextSequence } from '../../shared/sequence';
import { SessionModel } from './session.model';
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

export async function registerPatient(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  client: ClientInfo;
}): Promise<{ user: UserDoc; tokens: IssuedTokens }> {
  const existing = await UserModel.findOne({ email: input.email.toLowerCase() }).lean();
  if (existing) throw new ConflictError('An account with this email already exists.');

  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash: await hashPassword(input.password),
  });

  // Patient-portal endpoints (see patientTenantContext) resolve clinic scope from a
  // PatientModel record whose _id equals the logged-in user's id — create that link
  // now. Self-service sign-up has no clinic-selection step yet, so the new patient is
  // attached to the single/first active clinic; multi-clinic self-signup (choosing a
  // clinic, or joining via an invite/QR link) is a follow-up, not covered here.
  const clinic = await ClinicModel.findOne({ isActive: true, deletedAt: null })
    .sort({ createdAt: 1 })
    .lean();
  if (clinic) {
    const seq = await nextSequence(`patient:${clinic._id.toString()}`);
    await PatientModel.create({
      _id: user._id,
      organizationId: clinic.organizationId,
      clinicId: clinic._id,
      code: formatToken('P', seq, 6),
      fullName: input.name,
      gender: 'unknown',
      mobile: input.phone,
      email: input.email,
      emergencyContacts: [],
      allergies: [],
      conditions: [],
      currentMedicines: [],
    });
  } else {
    logger.warn(
      { userId: user._id.toString() },
      'patient registered with no active clinic to attach to — patient-portal data endpoints will 404 until one exists',
    );
  }

  const tokens = await issueSession(user, input.client);
  return { user, tokens };
}

export async function loginPatient(
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
      'ACCOUNT_LOCKED',
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
    throw new UnauthenticatedError('Session expired. Please sign in again.');
  }

  const user = await UserModel.findById(session.userId);
  if (!user || !user.isActive) throw new UnauthenticatedError();

  session.revokedAt = new Date();
  session.revokedReason = 'rotated';
  await session.save();

  const tokens = await issueSession(user, client, session.familyId);
  return { user, tokens };
}
