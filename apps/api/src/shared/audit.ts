import type { Request } from 'express';
import { AuditLogModel } from '../modules/audit-logs/audit-log.model';
import { logger } from './logger';

export interface AuditInput {
  action: string;
  resource: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

/**
 * Write an audit entry from a request context. Never throws — an audit failure is
 * logged loudly but must not roll back the underlying clinical/financial operation
 * (which has already been committed).
 */
export async function audit(req: Request, input: AuditInput): Promise<void> {
  try {
    await AuditLogModel.create({
      organizationId: req.tenant?.organizationId,
      clinicId: req.tenant?.clinicId,
      branchId: req.tenant?.branchId,
      userId: req.auth?.userId,
      userName: req.auth?.name,
      roleKey: req.tenant?.roleKey,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      before: input.before,
      after: input.after,
      reason: input.reason,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
    });
  } catch (err) {
    logger.error({ err, action: input.action }, 'audit write failed');
  }
}
