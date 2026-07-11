import { Schema, model, type Types } from 'mongoose';
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@clinicos/types';
import { tenantBase, type TenantFields } from '../../database/plugins';

/**
 * Patient document metadata. The underlying file lives in Cloudinary under a
 * `type: authenticated` delivery type (spec §26) — never publicly reachable by URL
 * alone. Only `cloudinaryPublicId` is stored here; the raw Cloudinary URL is never
 * persisted or exposed through the API. Versions are never deleted — `replace`
 * creates a new document row and archives the previous one (see document.service.ts).
 */
export interface DocumentDoc extends TenantFields {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  category: DocumentCategory;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  cloudinaryPublicId: string;
  version: number;
  previousVersionId?: Types.ObjectId;
  uploadedByUserId: Types.ObjectId;
  uploadedByName: string;
  archived: boolean;
}

const documentSchema = new Schema<DocumentDoc>(
  {
    patientId: { type: Schema.Types.ObjectId, required: true, index: true },
    category: { type: String, enum: DOCUMENT_CATEGORIES, required: true },
    title: { type: String, required: true, trim: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    cloudinaryPublicId: { type: String, required: true },
    version: { type: Number, required: true, default: 1 },
    previousVersionId: { type: Schema.Types.ObjectId },
    uploadedByUserId: { type: Schema.Types.ObjectId, required: true },
    uploadedByName: { type: String, required: true },
    archived: { type: Boolean, required: true, default: false },
  },
  { collection: 'documents' },
);

documentSchema.plugin(tenantBase);

// Patient document list / version history lookups.
documentSchema.index({ clinicId: 1, patientId: 1, createdAt: -1 });

export const DocumentModel = model<DocumentDoc>('Document', documentSchema);
