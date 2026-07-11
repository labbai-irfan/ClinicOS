import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SOCKET_EVENTS } from '@clinicos/types';
import { createTestClinic, authed, type TestClinic } from '../../test/helpers';
import { NotificationModel } from './notification.model';

vi.mock('../../realtime/emit', () => ({
  emitToBranch: vi.fn(),
  emitToClinic: vi.fn(),
  emitToDisplay: vi.fn(),
  emitToUser: vi.fn(),
}));

import { emitToUser } from '../../realtime/emit';
import * as notificationService from './notification.service';

describe('notifications module', () => {
  let clinic: TestClinic;
  let tenant: notificationService.TenantScope;

  beforeEach(async () => {
    vi.clearAllMocks();
    clinic = await createTestClinic();
    tenant = { organizationId: clinic.organizationId, clinicId: clinic.clinicId, branchId: clinic.branchId };
  });

  it('notify() creates a record that can be queried back and emits it to the recipient', async () => {
    const dto = await notificationService.notify(tenant, {
      userId: clinic.userIds.doctor,
      category: 'queue',
      priority: 'normal',
      title: 'Patient checked in',
      body: 'Asha Rao has checked in for her appointment.',
    });

    expect(dto.title).toBe('Patient checked in');
    expect(dto.read).toBe(false);

    const stored = await NotificationModel.findById(dto.id).lean();
    expect(stored).not.toBeNull();
    expect(stored?.userId.toString()).toBe(clinic.userIds.doctor.toString());
    expect(stored?.clinicId.toString()).toBe(clinic.clinicId.toString());

    const res = await authed(clinic.app, clinic.tokens.doctor).get('/api/v1/notifications');
    expect(res.status).toBe(200);
    expect(res.body.data.map((n: { id: string }) => n.id)).toContain(dto.id);

    expect(vi.mocked(emitToUser)).toHaveBeenCalledWith(
      expect.anything(),
      SOCKET_EVENTS.NOTIFICATION_NEW,
      expect.objectContaining({ id: dto.id, title: 'Patient checked in' }),
    );
  });

  it('lists only unread notifications when unreadOnly=true', async () => {
    const readLater = await notificationService.notify(tenant, {
      userId: clinic.userIds.nurse,
      category: 'appointment',
      priority: 'low',
      title: 'Appointment reminder',
    });
    await notificationService.notify(tenant, {
      userId: clinic.userIds.nurse,
      category: 'system',
      priority: 'low',
      title: 'System notice',
    });

    await authed(clinic.app, clinic.tokens.nurse).patch(`/api/v1/notifications/${readLater.id}/read`);

    const res = await authed(clinic.app, clinic.tokens.nurse).get('/api/v1/notifications?unreadOnly=true');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('System notice');
    expect(res.body.data[0].read).toBe(false);
  });

  it('marks one notification read, and 404s (never leaks existence) for one the caller does not own', async () => {
    const own = await notificationService.notify(tenant, {
      userId: clinic.userIds.receptionist,
      category: 'billing',
      priority: 'high',
      title: 'Payment received',
    });

    const res = await authed(clinic.app, clinic.tokens.receptionist).patch(`/api/v1/notifications/${own.id}/read`);
    expect(res.status).toBe(200);
    expect(res.body.data.read).toBe(true);

    const someoneElses = await notificationService.notify(tenant, {
      userId: clinic.userIds.doctor,
      category: 'billing',
      priority: 'high',
      title: 'Doctor-only notice',
    });
    const forbidden = await authed(clinic.app, clinic.tokens.receptionist).patch(
      `/api/v1/notifications/${someoneElses.id}/read`,
    );
    expect(forbidden.status).toBe(404);
  });

  it('bulk-marks all of a user notifications read via mark-all-read', async () => {
    await notificationService.notify(tenant, {
      userId: clinic.userIds.clinic_admin,
      category: 'queue',
      priority: 'normal',
      title: 'One',
    });
    await notificationService.notify(tenant, {
      userId: clinic.userIds.clinic_admin,
      category: 'queue',
      priority: 'normal',
      title: 'Two',
    });

    const res = await authed(clinic.app, clinic.tokens.clinic_admin).post('/api/v1/notifications/mark-all-read');
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(2);

    const list = await authed(clinic.app, clinic.tokens.clinic_admin).get('/api/v1/notifications');
    expect(list.body.data.every((n: { read: boolean }) => n.read === true)).toBe(true);
  });

  it('scopes notifications to the requesting user — a second user cannot see the first user notifications', async () => {
    await notificationService.notify(tenant, {
      userId: clinic.userIds.doctor,
      category: 'queue',
      priority: 'normal',
      title: 'For doctor only',
    });

    const doctorRes = await authed(clinic.app, clinic.tokens.doctor).get('/api/v1/notifications');
    expect(doctorRes.status).toBe(200);
    expect(doctorRes.body.data).toHaveLength(1);

    const nurseRes = await authed(clinic.app, clinic.tokens.nurse).get('/api/v1/notifications');
    expect(nurseRes.status).toBe(200);
    expect(nurseRes.body.data).toHaveLength(0);
  });
});
