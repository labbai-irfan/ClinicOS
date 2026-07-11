import { z } from 'zod';
import { QUEUE_ENTRY_SOURCES, QUEUE_STATUSES } from '@clinicos/types';
import { localDate, nonEmptyText, objectId, optionalText } from './common';

export const addToQueueSchema = z.object({
  patientId: objectId,
  doctorId: objectId.optional(),
  source: z.enum(QUEUE_ENTRY_SOURCES).default('walk_in'),
  appointmentId: objectId.optional(),
  reasonForVisit: optionalText(300),
  priority: z.number().int().min(0).max(10).default(0),
});
export type AddToQueueInput = z.infer<typeof addToQueueSchema>;

export const queueTransitionSchema = z.object({
  to: z.enum(QUEUE_STATUSES),
  reason: optionalText(500),
  expectedVersion: z.number().int().min(0).optional(),
});
export type QueueTransitionInput = z.infer<typeof queueTransitionSchema>;

export const queueSkipSchema = z.object({
  reason: nonEmptyText(500),
});

export const queueRejoinSchema = z.object({
  policy: z
    .enum(['after_next_patient', 'after_two_patients', 'end_of_priority_group', 'manual'])
    .optional(),
  manualPosition: z.number().int().min(0).optional(),
  reason: nonEmptyText(500),
});

export const queueTransferSchema = z.object({
  doctorId: objectId,
  reason: nonEmptyText(500),
});

export const queueListQuery = z.object({
  date: localDate.optional(),
  doctorId: objectId.optional(),
  status: z.enum(QUEUE_STATUSES).optional(),
  view: z.enum(['board', 'list']).default('board'),
});

export const callPatientSchema = z.object({
  room: optionalText(40),
});
