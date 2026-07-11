import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { createTestClinic, authed } from '../../test/helpers';
import { env } from '../../config/env';
import * as authService from '../auth/auth.service';
import { UserModel } from '../users/user.model';
import { RoleModel } from '../roles/role.model';
import { MembershipModel } from '../memberships/membership.model';
import { signAccessToken } from '../../middleware/authenticate';
import { DocumentModel } from './document.model';

// Cloudinary is an external network dependency — mock it so tests never make real
// HTTP calls. `document.service.ts` only touches `cloudinary.uploader.upload_stream`
// and `cloudinary.utils.private_download_url`, so those are the only surfaces stubbed.
vi.mock('cloudinary', () => {
  return {
    v2: {
      config: vi.fn(),
      uploader: {
        upload_stream: (
          _options: unknown,
          callback: (
            error: unknown,
            result?: { public_id: string; resource_type: string; bytes: number },
          ) => void,
        ) => {
          const chunks: Buffer[] = [];
          return {
            write(chunk: Buffer) {
              chunks.push(chunk);
              return true;
            },
            end(chunk?: Buffer) {
              if (chunk) chunks.push(chunk);
              callback(undefined, {
                public_id: `test/doc-${Math.random().toString(36).slice(2)}`,
                resource_type: 'raw',
                bytes: Buffer.concat(chunks).length,
              });
            },
          };
        },
      },
      utils: {
        private_download_url: vi.fn(() => 'https://res.cloudinary.com/test-cloud/signed/download-url'),
      },
    },
  };
});

const PDF_BYTES = Buffer.from('%PDF-1.4 fake test document content');

function configureCloudinary(): void {
  env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  env.CLOUDINARY_API_KEY = 'test-key';
  env.CLOUDINARY_API_SECRET = 'test-secret';
}

function unconfigureCloudinary(): void {
  env.CLOUDINARY_CLOUD_NAME = undefined;
  env.CLOUDINARY_API_KEY = undefined;
  env.CLOUDINARY_API_SECRET = undefined;
}

describe('documents module', () => {
  beforeEach(() => {
    unconfigureCloudinary();
  });

  it('rejects upload for a disallowed mimetype', async () => {
    const { app, tokens } = await createTestClinic();
    const patientId = new Types.ObjectId().toString();

    const res = await authed(app, tokens.receptionist)
      .post('/api/v1/documents')
      .field('patientId', patientId)
      .field('category', 'other')
      .field('title', 'Suspicious file')
      .attach('file', Buffer.from('not really an executable'), {
        filename: 'virus.exe',
        contentType: 'application/x-msdownload',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects upload with 503 when Cloudinary is not configured', async () => {
    const { app, tokens } = await createTestClinic();
    const patientId = new Types.ObjectId().toString();

    const res = await authed(app, tokens.receptionist)
      .post('/api/v1/documents')
      .field('patientId', patientId)
      .field('category', 'lab_report')
      .field('title', 'Blood test')
      .attach('file', PDF_BYTES, { filename: 'blood-test.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.error.message).toBe('Document storage is not configured yet.');
  });

  it('lists documents by patient without exposing the cloudinary public id', async () => {
    configureCloudinary();
    const { app, tokens } = await createTestClinic();
    const patientId = new Types.ObjectId().toString();

    const uploadRes = await authed(app, tokens.receptionist)
      .post('/api/v1/documents')
      .field('patientId', patientId)
      .field('category', 'identity')
      .field('title', 'ID Card')
      .attach('file', PDF_BYTES, { filename: 'id.pdf', contentType: 'application/pdf' });
    expect(uploadRes.status).toBe(201);

    const listRes = await authed(app, tokens.receptionist).get(`/api/v1/documents?patientId=${patientId}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0]).toMatchObject({
      title: 'ID Card',
      category: 'identity',
      version: 1,
      archived: false,
    });
    expect(listRes.body.data[0].cloudinaryPublicId).toBeUndefined();
  });

  it('archives a document', async () => {
    configureCloudinary();
    const { app, tokens } = await createTestClinic();
    const patientId = new Types.ObjectId().toString();

    const uploadRes = await authed(app, tokens.clinic_admin)
      .post('/api/v1/documents')
      .field('patientId', patientId)
      .field('category', 'consent')
      .field('title', 'Consent form')
      .attach('file', PDF_BYTES, { filename: 'consent.pdf', contentType: 'application/pdf' });
    const id = uploadRes.body.data.id as string;

    const archiveRes = await authed(app, tokens.clinic_admin).patch(`/api/v1/documents/${id}/archive`);

    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.archived).toBe(true);
  });

  it('replace creates a new version and archives the old one', async () => {
    configureCloudinary();
    const { app, tokens } = await createTestClinic();
    const patientId = new Types.ObjectId().toString();

    const uploadRes = await authed(app, tokens.clinic_admin)
      .post('/api/v1/documents')
      .field('patientId', patientId)
      .field('category', 'lab_report')
      .field('title', 'CBC report')
      .attach('file', PDF_BYTES, { filename: 'cbc-v1.pdf', contentType: 'application/pdf' });
    const originalId = uploadRes.body.data.id as string;
    expect(uploadRes.body.data.version).toBe(1);

    const replaceRes = await authed(app, tokens.clinic_admin)
      .post(`/api/v1/documents/${originalId}/replace`)
      .field('patientId', patientId)
      .field('category', 'lab_report')
      .field('title', 'CBC report (corrected)')
      .attach('file', PDF_BYTES, { filename: 'cbc-v2.pdf', contentType: 'application/pdf' });

    expect(replaceRes.status).toBe(201);
    expect(replaceRes.body.data.version).toBe(2);
    expect(replaceRes.body.data.id).not.toBe(originalId);
    expect(replaceRes.body.data.archived).toBe(false);

    const original = await DocumentModel.findById(originalId);
    expect(original?.archived).toBe(true);

    const listRes = await authed(app, tokens.clinic_admin).get(`/api/v1/documents?patientId=${patientId}`);
    expect(listRes.body.data).toHaveLength(2);
  });

  it('forbids upload without DOCUMENT_UPLOAD permission', async () => {
    const { app, clinicId, organizationId, branchId } = await createTestClinic();

    // super_admin ships with an empty permission set by default (DEFAULT_ROLE_PERMISSIONS) —
    // used here purely to exercise a role that lacks document.upload.
    const role = await RoleModel.create({
      organizationId,
      clinicId,
      key: 'super_admin',
      name: 'Super Admin',
      permissions: [],
      isSystem: true,
    });
    const user = await UserModel.create({
      name: 'No Upload User',
      email: `no-upload-${Date.now()}@test.dev`,
      passwordHash: await authService.hashPassword('Password1'),
    });
    await MembershipModel.create({
      userId: user._id,
      organizationId,
      clinicId,
      roleId: role._id,
      roleKey: 'super_admin',
      branchIds: [branchId],
    });
    const token = signAccessToken({
      sub: user._id.toString(),
      sid: new Types.ObjectId().toString(),
      email: user.email,
      name: user.name,
    });

    const patientId = new Types.ObjectId().toString();
    const res = await authed(app, token)
      .post('/api/v1/documents')
      .field('patientId', patientId)
      .field('category', 'other')
      .field('title', 'Blocked upload')
      .attach('file', PDF_BYTES, { filename: 'blocked.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
