import { Types } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import { ERROR_CODES, type DocumentCategory } from '@clinicos/types';
import { env } from '../../config/env';
import { AppError, NotFoundError } from '../../shared/errors';
import { DocumentModel, type DocumentDoc } from './document.model';

/** Tenant scoping context, resolved by `tenantContext` middleware — never from client input. */
export interface TenantScope {
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  branchId: Types.ObjectId;
}

export interface Actor {
  userId: Types.ObjectId;
  name: string;
}

export interface UploadedFile {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
}

export interface UploadInput {
  patientId: string;
  category: DocumentCategory;
  title: string;
}

let cloudinaryConfigured = false;

/** True once CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET are all present. */
export function isCloudinaryConfigured(): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

/**
 * Throws a 503 rather than crashing when Cloudinary credentials are absent — expected
 * to be the normal state until real credentials are supplied (spec §26).
 */
function ensureCloudinaryConfigured(): void {
  if (!isCloudinaryConfigured()) {
    throw new AppError(503, ERROR_CODES.SERVICE_UNAVAILABLE, 'Document storage is not configured yet.');
  }
  if (!cloudinaryConfigured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
    cloudinaryConfigured = true;
  }
}

/**
 * Uploads a buffer to Cloudinary under `type: authenticated` so the asset is never
 * publicly reachable by URL alone — only a short-lived signed URL (see
 * `getDownloadUrl`) can retrieve it.
 */
function uploadToCloudinary(buffer: Buffer, folder: string): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder,
        type: 'authenticated',
        // Keep the original filename as the base of the public id (Cloudinary still
        // appends a short random suffix so re-uploads never overwrite each other),
        // so assets are readable in the Media Library instead of opaque ids.
        use_filename: true,
        unique_filename: true,
      },
      (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload failed'));
          return;
        }
        resolve(result);
      },
    );
    stream.end(buffer);
  });
}

/**
 * Deterministic, human-readable folder path so every asset lives in a predictable
 * place — `clinicos/<clinicId>/patients/<patientId>/<category>` — instead of a random
 * location. New categories automatically get their own subfolder.
 */
function folderFor(clinicId: Types.ObjectId, patientId: string, category: DocumentCategory): string {
  return `clinicos/${clinicId.toString()}/patients/${patientId}/${category}`;
}

export async function uploadDocument(
  tenant: TenantScope,
  actor: Actor,
  file: UploadedFile,
  input: UploadInput,
): Promise<DocumentDoc> {
  ensureCloudinaryConfigured();
  const result = await uploadToCloudinary(
    file.buffer,
    folderFor(tenant.clinicId, input.patientId, input.category),
  );

  return DocumentModel.create({
    organizationId: tenant.organizationId,
    clinicId: tenant.clinicId,
    branchId: tenant.branchId,
    patientId: new Types.ObjectId(input.patientId),
    category: input.category,
    title: input.title,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    cloudinaryPublicId: result.public_id,
    version: 1,
    uploadedByUserId: actor.userId,
    uploadedByName: actor.name,
    archived: false,
  });
}

export async function listByPatient(
  tenant: TenantScope,
  patientId: string,
  archived?: boolean,
): Promise<DocumentDoc[]> {
  const filter: Record<string, unknown> = {
    clinicId: tenant.clinicId,
    patientId: new Types.ObjectId(patientId),
    deletedAt: null,
  };
  if (archived !== undefined) filter.archived = archived;
  return DocumentModel.find(filter).sort({ createdAt: -1 });
}

export async function getByIdOrThrow(tenant: TenantScope, id: string): Promise<DocumentDoc> {
  const doc = await DocumentModel.findOne({ _id: id, clinicId: tenant.clinicId, deletedAt: null }).lean();
  if (!doc) throw new NotFoundError('Document');
  return doc;
}

/** Generates a five-minute signed download URL and never returns the raw public one. */
export async function getDownloadUrl(
  tenant: TenantScope,
  id: string,
): Promise<{ doc: DocumentDoc; url: string }> {
  ensureCloudinaryConfigured();
  const doc = await getByIdOrThrow(tenant, id);
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  const url = cloudinary.utils.private_download_url(doc.cloudinaryPublicId, '', {
    resource_type: 'auto',
    type: 'authenticated',
    expires_at: expiresAt,
  });
  return { doc, url };
}

/**
 * Creates a NEW document row (version = previous + 1, previousVersionId = old id) and
 * archives the previous row — the old version is never deleted, it stays as history.
 * The patient a document belongs to never changes on replace, so the previous
 * document's patientId is authoritative regardless of what the client sends.
 */
export async function replaceDocument(
  tenant: TenantScope,
  actor: Actor,
  id: string,
  file: UploadedFile,
  input: { category: DocumentCategory; title: string },
): Promise<DocumentDoc> {
  ensureCloudinaryConfigured();
  const previous = await getByIdOrThrow(tenant, id);
  const result = await uploadToCloudinary(
    file.buffer,
    folderFor(tenant.clinicId, previous.patientId.toString(), input.category),
  );

  const next = await DocumentModel.create({
    organizationId: tenant.organizationId,
    clinicId: tenant.clinicId,
    branchId: tenant.branchId,
    patientId: previous.patientId,
    category: input.category,
    title: input.title,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    cloudinaryPublicId: result.public_id,
    version: previous.version + 1,
    previousVersionId: previous._id,
    uploadedByUserId: actor.userId,
    uploadedByName: actor.name,
    archived: false,
  });

  await DocumentModel.updateOne(
    { _id: previous._id, clinicId: tenant.clinicId },
    { $set: { archived: true } },
  );

  return next;
}

export async function archiveDocument(tenant: TenantScope, id: string): Promise<DocumentDoc> {
  const doc = await DocumentModel.findOneAndUpdate(
    { _id: id, clinicId: tenant.clinicId, deletedAt: null },
    { $set: { archived: true } },
    { new: true },
  ).lean();
  if (!doc) throw new NotFoundError('Document');
  return doc;
}
