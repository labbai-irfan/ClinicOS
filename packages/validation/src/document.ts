import { z } from 'zod';
import { DOCUMENT_CATEGORIES } from '@clinicos/types';
import { nonEmptyText, objectId } from './common';

/** Body fields sent alongside the multipart `file` field for upload and replace. */
export const documentUploadSchema = z.object({
  patientId: objectId,
  category: z.enum(DOCUMENT_CATEGORIES),
  title: nonEmptyText(200),
});
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;

export const documentListQuery = z.object({
  patientId: objectId,
  archived: z.coerce.boolean().optional(),
});
export type DocumentListQuery = z.infer<typeof documentListQuery>;
