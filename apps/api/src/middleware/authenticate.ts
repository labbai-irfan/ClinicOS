import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { ERROR_CODES } from '@clinicos/types';
import { env } from '../config/env';
import { UnauthenticatedError } from '../shared/errors';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  email: string;
  name: string;
  type: 'access';
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new UnauthenticatedError());
    return;
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (payload.type !== 'access') throw new Error('wrong token type');
    req.auth = {
      userId: new Types.ObjectId(payload.sub),
      sessionId: new Types.ObjectId(payload.sid),
      email: payload.email,
      name: payload.name,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new UnauthenticatedError('Your session has expired.', ERROR_CODES.TOKEN_EXPIRED));
      return;
    }
    next(new UnauthenticatedError());
  }
}
