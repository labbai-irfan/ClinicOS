import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { logger } from '../shared/logger';
import { MembershipModel } from '../modules/memberships/membership.model';
import type { AccessTokenPayload } from '../middleware/authenticate';

let io: Server | null = null;

export function getIo(): Server | null {
  return io;
}

/**
 * Authenticated staff sockets join clinic/branch/user rooms.
 * Waiting-room displays join ONLY `branch:<id>:display`, whose payloads are
 * privacy-safe by construction (tokens, never names or clinical data).
 */
export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: env.WEB_ORIGIN, credentials: true },
  });

  io.on('connection', async (socket) => {
    const { token, displayBranchId } = socket.handshake.auth as {
      token?: string;
      displayBranchId?: string;
    };

    if (displayBranchId && Types.ObjectId.isValid(displayBranchId)) {
      await socket.join(`branch:${displayBranchId}:display`);
      logger.debug({ displayBranchId }, 'display client connected');
      return;
    }

    if (!token) {
      socket.disconnect(true);
      return;
    }
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
      if (payload.type !== 'access') throw new Error('wrong token type');
      const membership = await MembershipModel.findOne({
        userId: new Types.ObjectId(payload.sub),
        isActive: true,
      }).lean();
      if (!membership) {
        socket.disconnect(true);
        return;
      }
      await socket.join(`user:${payload.sub}`);
      await socket.join(`clinic:${membership.clinicId.toString()}`);
      for (const b of membership.branchIds) await socket.join(`branch:${b.toString()}`);
      logger.debug({ userId: payload.sub }, 'staff socket connected');
    } catch {
      socket.disconnect(true);
    }
  });

  return io;
}
