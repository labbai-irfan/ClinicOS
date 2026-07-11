import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { tenantContext } from '../../middleware/tenant';
import { authorize } from '../../middleware/authorize';
import { asyncHandler } from '../../shared/http';
import { PERMISSIONS } from '@clinicos/types';
import { AuditLogModel } from './audit-log.model';
import { ok } from '../../shared/http';
import { parsePagination } from '../../shared/pagination';

export const auditLogRoutes = Router();

auditLogRoutes.get(
  '/',
  authenticate,
  tenantContext,
  authorize(PERMISSIONS.AUDIT_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req);
    const total = await AuditLogModel.countDocuments({ clinicId: req.tenant!.clinicId });
    const docs = await AuditLogModel.find({ clinicId: req.tenant!.clinicId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    return ok(res, docs, { page, limit, total });
  }),
);
