import type { CookieOptions, Request, Response } from 'express';
import type { AuthUserDto, LoginResponseDto, Permission } from '@clinicos/types';
import { env } from '../../config/env';
import { ok, created } from '../../shared/http';
import { audit } from '../../shared/audit';
import { UnauthenticatedError } from '../../shared/errors';
import { MembershipModel } from '../memberships/membership.model';
import { RoleModel } from '../roles/role.model';
import { ClinicModel } from '../clinics/clinic.model';
import { UserModel, type UserDoc } from '../users/user.model';
import * as authService from './auth.service';
import { logger } from '../../shared/logger';

const REFRESH_COOKIE = 'clinicos_refresh';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax',
  path: '/api/v1/auth',
};

/**
 * Native (Capacitor) clients send `X-Client-Type: native` and cannot always rely on
 * cross-origin cookies persisting inside a WebView, so they store the refresh token
 * themselves (secure device storage) instead. Web clients never receive the refresh
 * token in the response body — only via the httpOnly cookie — so it stays
 * inaccessible to JavaScript/XSS in the browser.
 */
function isNativeClient(req: Request): boolean {
  return req.headers['x-client-type'] === 'native';
}

async function buildAuthUser(user: UserDoc): Promise<{ dto: AuthUserDto; onboardingComplete: boolean }> {
  const membership = await MembershipModel.findOne({ userId: user._id, isActive: true }).lean();
  let permissions: Permission[] = [];
  let onboardingComplete = false;
  let clinicId: string | null = null;
  let organizationId = '';
  let branchIds: string[] = [];
  let roleKey: AuthUserDto['roleKey'] = 'patient';

  if (membership) {
    const [role, clinic] = await Promise.all([
      RoleModel.findById(membership.roleId).lean(),
      ClinicModel.findById(membership.clinicId).lean(),
    ]);
    permissions = (role?.permissions ?? []) as Permission[];
    onboardingComplete = clinic?.onboardingComplete ?? false;
    clinicId = membership.clinicId.toString();
    organizationId = membership.organizationId.toString();
    branchIds = membership.branchIds.map((b) => b.toString());
    roleKey = membership.roleKey;
  }

  return {
    dto: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      roleKey,
      permissions,
      organizationId,
      clinicId,
      branchIds,
      activeBranchId: branchIds[0] ?? null,
      mustChangePassword: user.mustChangePassword || undefined,
    },
    onboardingComplete,
  };
}

export async function registerOwner(req: Request, res: Response): Promise<void> {
  const { user, tokens } = await authService.registerOwner({
    ...req.body,
    client: { ip: req.ip, userAgent: req.headers['user-agent'] },
  });
  const { dto, onboardingComplete } = await buildAuthUser(user);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
  await audit(req, { action: 'auth.register_owner', resource: 'user', resourceId: dto.id });
  const body: LoginResponseDto = {
    user: dto,
    accessToken: tokens.accessToken,
    refreshToken: isNativeClient(req) ? tokens.refreshToken : undefined,
    onboardingComplete,
  };
  created(res, body);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const { user, tokens } = await authService.login(email, password, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  const { dto, onboardingComplete } = await buildAuthUser(user);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
  await audit(req, { action: 'auth.login', resource: 'user', resourceId: dto.id });
  const body: LoginResponseDto = {
    user: dto,
    accessToken: tokens.accessToken,
    refreshToken: isNativeClient(req) ? tokens.refreshToken : undefined,
    onboardingComplete,
  };
  ok(res, body);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  // Browser (web) clients rely on the httpOnly cookie. Native/Capacitor clients
  // cannot always persist cross-origin cookies reliably in a WebView, so they may
  // instead store the refresh token themselves (secure device storage) and send it
  // in the body — same rotation/reuse-detection logic applies either way.
  const cookieToken = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
  const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  const token = cookieToken ?? bodyToken;
  if (!token) throw new UnauthenticatedError('Session expired. Please sign in again.');
  const { user, tokens } = await authService.rotateRefreshToken(token, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  const { dto, onboardingComplete } = await buildAuthUser(user);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
  const body: LoginResponseDto = {
    user: dto,
    accessToken: tokens.accessToken,
    refreshToken: isNativeClient(req) || bodyToken ? tokens.refreshToken : undefined,
    onboardingComplete,
  };
  ok(res, body);
}

export async function logout(req: Request, res: Response): Promise<void> {
  if (req.auth) await authService.logout(req.auth.sessionId);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  ok(res, { loggedOut: true });
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new UnauthenticatedError();
  const count = await authService.logoutAll(req.auth.userId);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  await audit(req, { action: 'auth.logout_all', resource: 'user', resourceId: req.auth.userId.toString() });
  ok(res, { revokedSessions: count });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new UnauthenticatedError();
  const user = await UserModel.findById(req.auth.userId);
  if (!user) throw new UnauthenticatedError();
  const { dto, onboardingComplete } = await buildAuthUser(user);
  ok(res, { user: dto, onboardingComplete });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string };
  const token = await authService.createPasswordResetToken(email);
  if (token) {
    // No email provider is configured in Phase 1 — surface through server logs only.
    logger.info({ email, resetToken: token }, 'password reset token issued (no mail channel configured)');
  }
  ok(res, { message: 'If that account exists, reset instructions have been issued.' });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as { token: string; password: string };
  await authService.resetPassword(token, password);
  ok(res, { message: 'Password has been reset. Please sign in.' });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new UnauthenticatedError();
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };
  await authService.changePassword(req.auth.userId, currentPassword, newPassword);
  await audit(req, { action: 'auth.change_password', resource: 'user', resourceId: req.auth.userId.toString() });
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  ok(res, { message: 'Password changed. Please sign in again.' });
}

export async function sessions(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new UnauthenticatedError();
  const items = await authService.listActiveSessions(req.auth.userId);
  ok(
    res,
    items.map((s) => ({
      id: s._id.toString(),
      ip: s.ip,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      current: s._id.equals(req.auth!.sessionId),
    })),
  );
}
