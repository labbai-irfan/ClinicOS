import type { Types } from 'mongoose';
import type { SocketEvent } from '@clinicos/types';
import { getIo } from './socket';

type Id = string | Types.ObjectId;

export function emitToBranch(branchId: Id, event: SocketEvent, payload: unknown): void {
  getIo()?.to(`branch:${branchId.toString()}`).emit(event, payload);
}

export function emitToClinic(clinicId: Id, event: SocketEvent, payload: unknown): void {
  getIo()?.to(`clinic:${clinicId.toString()}`).emit(event, payload);
}

/** Waiting-room display room — payloads must be privacy-safe (no names, no PHI). */
export function emitToDisplay(branchId: Id, event: SocketEvent, payload: unknown): void {
  getIo()?.to(`branch:${branchId.toString()}:display`).emit(event, payload);
}

export function emitToUser(userId: Id, event: SocketEvent, payload: unknown): void {
  getIo()?.to(`user:${userId.toString()}`).emit(event, payload);
}
