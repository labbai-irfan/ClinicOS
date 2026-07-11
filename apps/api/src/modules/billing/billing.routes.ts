import { Router } from 'express';
import { z } from 'zod';
import {
  createInvoiceSchema,
  recordPaymentSchema,
  refundSchema,
  objectId,
  paginationQuery,
  isoDate,
  localDate,
} from '@clinicos/validation';
import { PERMISSIONS, INVOICE_STATUSES } from '@clinicos/types';
import { authenticate, tenantContext, authorize, validate, idempotent } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './billing.controller';

export const billingRoutes = Router();

billingRoutes.use(authenticate, tenantContext);

const idParams = z.object({ id: objectId });

const listInvoicesQuery = paginationQuery.extend({
  patientId: objectId.optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

const dailyClosingQuery = z.object({ date: localDate.optional() });

// Duplicate submission (double-click, retry after timeout) would otherwise create two
// invoices for the same visit — idempotent() de-dupes on the client's Idempotency-Key.
billingRoutes.post(
  '/invoices',
  authorize(PERMISSIONS.BILLING_CREATE),
  idempotent(),
  validate(createInvoiceSchema),
  asyncHandler(controller.createInvoice),
);

billingRoutes.get(
  '/invoices',
  authorize(PERMISSIONS.BILLING_READ),
  validate(listInvoicesQuery, 'query'),
  asyncHandler(controller.listInvoices),
);

// Fixed segment routes must be declared before the exact same "/invoices/:id"
// pattern only where they would otherwise collide — here they're distinct suffixed
// paths, so ordering is not load-bearing, but kept grouped for readability.
billingRoutes.get(
  '/invoices/:id',
  authorize(PERMISSIONS.BILLING_READ),
  validate(idParams, 'params'),
  asyncHandler(controller.getInvoice),
);

billingRoutes.get(
  '/invoices/:id/pdf',
  authorize(PERMISSIONS.BILLING_READ),
  validate(idParams, 'params'),
  asyncHandler(controller.invoicePdf),
);

// The single most important idempotency point in the app: a retried/duplicated
// payment submission must never double-charge a patient.
billingRoutes.post(
  '/invoices/:id/payments',
  authorize(PERMISSIONS.BILLING_CREATE),
  idempotent(),
  validate(idParams, 'params'),
  validate(recordPaymentSchema),
  asyncHandler(controller.recordPayments),
);

billingRoutes.post(
  '/payments/:id/refund',
  authorize(PERMISSIONS.BILLING_REFUND),
  validate(idParams, 'params'),
  validate(refundSchema),
  asyncHandler(controller.refundPayment),
);

billingRoutes.get(
  '/payments/:id/receipt-pdf',
  authorize(PERMISSIONS.BILLING_READ),
  validate(idParams, 'params'),
  asyncHandler(controller.receiptPdf),
);

billingRoutes.get(
  '/daily-closing',
  authorize(PERMISSIONS.BILLING_READ),
  validate(dailyClosingQuery, 'query'),
  asyncHandler(controller.dailyClosing),
);
