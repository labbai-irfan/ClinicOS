/** Canonical Socket.IO event names. Rooms: clinic:<id>, branch:<id>, branch:<id>:display, user:<id>. */
export const SOCKET_EVENTS = {
  // Queue
  QUEUE_UPDATED: 'queue:updated',
  QUEUE_ENTRY_CHANGED: 'queue:entry-changed',
  QUEUE_CALLED: 'queue:called',
  QUEUE_DELAYED: 'queue:delayed',
  // Waiting-room display (privacy-safe payloads only)
  DISPLAY_STATE: 'display:state',
  // Appointments
  APPOINTMENT_CHANGED: 'appointment:changed',
  // Emergency
  EMERGENCY_CREATED: 'emergency:created',
  EMERGENCY_UPDATED: 'emergency:updated',
  EMERGENCY_DOCTOR_ALERT: 'emergency:doctor-alert',
  // Staff / availability
  DOCTOR_AVAILABILITY: 'staff:doctor-availability',
  // Notifications
  NOTIFICATION_NEW: 'notification:new',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

/** Payload for the public waiting-room display. MUST NOT contain names or clinical data. */
export interface DisplayState {
  branchId: string;
  nowConsulting: Array<{ token: string; room?: string; doctorLabel: string }>;
  nextTokens: string[];
  delayed: boolean;
  delayMessage?: string;
  announcement?: string;
  updatedAt: string;
}

export interface QueueEntryChangedPayload {
  entryId: string;
  branchId: string;
  doctorId?: string;
  status: string;
  token: string;
}
