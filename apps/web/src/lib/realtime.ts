import { io, type Socket } from 'socket.io-client';
import type { SocketEvent } from '@clinicos/types';
import { useAuthStore } from '../stores/auth-store';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

/** Authenticated staff socket — joins clinic/branch/user rooms server-side (see apps/api realtime/socket.ts). */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(API_URL, {
    autoConnect: false,
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
  });
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) s.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

export function onSocketEvent<T = unknown>(event: SocketEvent, handler: (payload: T) => void): () => void {
  const s = getSocket();
  s.on(event, handler as (...args: unknown[]) => void);
  return () => s.off(event, handler as (...args: unknown[]) => void);
}

/** Unauthenticated display socket for the public waiting-room screen (spec §17). */
export function connectDisplaySocket(branchId: string): Socket {
  const displaySocket = io(API_URL, { auth: { displayBranchId: branchId } });
  return displaySocket;
}
