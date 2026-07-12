import type { CookieOptions, Request, Response } from 'express';
import type { LoginResponseDto } from '@clinicos/types';
import { env } from '../../config/env';
import { ok, created } from '../../shared/http';
import { audit } from '../../shared/audit';
import { UnauthenticatedError } from '../../shared/errors';
import { UserModel } from '../users/user.model';
import * as patientAuthService from './patient.service';
import { asyncHandler } from '../../shared/http';

const REFRESH_COOKIE = 'clinicos_patient_refresh';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax',
  path: '/api/v1/patient/auth',
};

function isNativeClient(req: Request): boolean {
  return req.headers['x-client-type'] === 'native';
}

export const registerPatient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { user, tokens } = await patientAuthService.registerPatient({
    ...req.body,
    client: { ip: req.ip, userAgent: req.headers['user-agent'] },
  });

  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
  await audit(req, { action: 'auth.register_patient', resource: 'user', resourceId: user._id.toString() });

  const body: LoginResponseDto = {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      roleKey: 'patient',
      permissions: [],
      organizationId: '',
      clinicId: null,
      branchIds: [],
      activeBranchId: null,
    },
    accessToken: tokens.accessToken,
    refreshToken: isNativeClient(req) ? tokens.refreshToken : undefined,
    onboardingComplete: false,
  };
  created(res, body);
});

export const loginPatient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };
  const { user, tokens } = await patientAuthService.loginPatient(email, password, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
  await audit(req, { action: 'auth.login_patient', resource: 'user', resourceId: user._id.toString() });

  const body: LoginResponseDto = {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      roleKey: 'patient',
      permissions: [],
      organizationId: '',
      clinicId: null,
      branchIds: [],
      activeBranchId: null,
    },
    accessToken: tokens.accessToken,
    refreshToken: isNativeClient(req) ? tokens.refreshToken : undefined,
    onboardingComplete: false,
  };
  ok(res, body);
});

export const refreshPatient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const cookieToken = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
  const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  const token = cookieToken ?? bodyToken;

  if (!token) throw new UnauthenticatedError('Session expired. Please sign in again.');

  const { user, tokens } = await patientAuthService.rotateRefreshToken(token, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);

  const body: LoginResponseDto = {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      roleKey: 'patient',
      permissions: [],
      organizationId: '',
      clinicId: null,
      branchIds: [],
      activeBranchId: null,
    },
    accessToken: tokens.accessToken,
    refreshToken: isNativeClient(req) || bodyToken ? tokens.refreshToken : undefined,
    onboardingComplete: false,
  };
  ok(res, body);
});
