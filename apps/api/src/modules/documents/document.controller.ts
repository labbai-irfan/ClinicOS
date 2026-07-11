import type { Request, Response } from 'express';
import type { DocumentDto } from '@clinicos/types';
import type { DocumentListQuery, DocumentUploadInput } from '@clinicos/validation';
import { ok, created } from '../../shared/http';
import { audit } from '../../shared/audit';
import { UnauthenticatedError, ValidationError } from '../../shared/errors';
import * as service from './document.service';
import type { DocumentDoc } from './document.model';

function requireTenant(req: Request): service.TenantScope {
  if (!req.tenant) throw new UnauthenticatedError();
  return {
    organizationId: req.tenant.organizationId,
    clinicId: req.tenant.clinicId,
    branchId: req.tenant.branchId,
  };
}

function requireActor(req: Request): service.Actor {
  if (!req.auth) throw new UnauthenticatedError();
  return { userId: req.auth.userId, name: req.auth.name };
}

function requireFile(req: Request): Express.Multer.File {
  if (!req.file) throw new ValidationError([{ field: 'file', message: 'A file is required.' }]);
  return req.file;
}

/** Maps to DocumentDto only — never the cloudinaryPublicId or any raw URL (spec §26). */
function toDto(doc: DocumentDoc): DocumentDto {
  return {
    id: doc._id.toString(),
    patientId: doc.patientId.toString(),
    category: doc.category,
    title: doc.title,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    version: doc.version,
    uploadedByName: doc.uploadedByName,
    createdAt: doc.createdAt.toISOString(),
    archived: doc.archived,
  };
}

/** POST /documents — multipart upload (field "file" + patientId/category/title). */
export async function upload(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const actor = requireActor(req);
  const file = requireFile(req);
  const input = req.body as DocumentUploadInput;
  const doc = await service.uploadDocument(
    tenant,
    actor,
    {
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname,
      sizeBytes: file.size,
    },
    input,
  );
  await audit(req, { action: 'document.upload', resource: 'document', resourceId: doc._id.toString() });
  created(res, toDto(doc));
}

/** GET /documents?patientId= — metadata only, never the raw Cloudinary URL. */
export async function list(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const query = req.query as unknown as DocumentListQuery;
  const docs = await service.listByPatient(tenant, query.patientId, query.archived);
  ok(res, docs.map(toDto));
}

/** GET /documents/:id/download — 302 redirect to a five-minute signed Cloudinary URL. */
export async function download(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const { doc, url } = await service.getDownloadUrl(tenant, req.params.id as string);
  await audit(req, { action: 'document.access', resource: 'document', resourceId: doc._id.toString() });
  res.redirect(302, url);
}

/** POST /documents/:id/replace — new version row, old one archived (never deleted). */
export async function replace(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const actor = requireActor(req);
  const file = requireFile(req);
  const input = req.body as DocumentUploadInput;
  const doc = await service.replaceDocument(
    tenant,
    actor,
    req.params.id as string,
    {
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname,
      sizeBytes: file.size,
    },
    { category: input.category, title: input.title },
  );
  await audit(req, {
    action: 'document.replace',
    resource: 'document',
    resourceId: doc._id.toString(),
    after: { previousVersionId: doc.previousVersionId?.toString(), version: doc.version },
  });
  created(res, toDto(doc));
}

/** PATCH /documents/:id/archive */
export async function archive(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const doc = await service.archiveDocument(tenant, req.params.id as string);
  await audit(req, { action: 'document.archive', resource: 'document', resourceId: doc._id.toString() });
  ok(res, toDto(doc));
}
