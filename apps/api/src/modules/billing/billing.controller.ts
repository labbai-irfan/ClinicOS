import type { Request, Response } from 'express';
import type { InvoiceDto, InvoiceItemDto, InvoiceStatus, PaymentDto } from '@clinicos/types';
import type { CreateInvoiceInput, RecordPaymentInput } from '@clinicos/validation';
import { ok, created } from '../../shared/http';
import { audit } from '../../shared/audit';
import { UnauthenticatedError } from '../../shared/errors';
import { parsePagination } from '../../shared/pagination';
import { todayInTimezone } from '../../shared/dates';
import { ClinicModel } from '../clinics/clinic.model';
import * as service from './billing.service';
import type { InvoiceDoc, InvoiceItem } from './invoice.model';
import type { PaymentDoc } from './payment.model';
import { buildInvoicePdf, buildReceiptPdf, type ClinicHeaderInfo } from './billing.invoice.pdf';

function requireContext(req: Request): service.BillingContext {
  if (!req.auth) throw new UnauthenticatedError();
  if (!req.tenant) throw new UnauthenticatedError();
  return {
    organizationId: req.tenant.organizationId,
    clinicId: req.tenant.clinicId,
    branchId: req.tenant.branchId,
    timezone: req.tenant.timezone,
    permissions: req.tenant.permissions,
    userId: req.auth.userId,
    userName: req.auth.name,
  };
}

function itemToDto(item: InvoiceItem): InvoiceItemDto {
  return {
    description: item.description,
    type: item.type,
    quantity: item.quantity,
    unitPricePaise: item.unitPricePaise,
    totalPaise: item.totalPaise,
  };
}

function invoiceToDto(doc: InvoiceDoc): InvoiceDto {
  return {
    id: doc._id.toString(),
    invoiceNumber: doc.invoiceNumber,
    patientId: doc.patientId.toString(),
    queueEntryId: doc.queueEntryId?.toString(),
    emergencyCaseId: doc.emergencyCaseId?.toString(),
    items: doc.items.map(itemToDto),
    subtotalPaise: doc.subtotalPaise,
    discountPaise: doc.discountPaise,
    discountReason: doc.discountReason,
    totalPaise: doc.totalPaise,
    paidPaise: doc.paidPaise,
    refundedPaise: doc.refundedPaise,
    status: doc.status,
    deferred: doc.deferred,
    createdAt: doc.createdAt.toISOString(),
  };
}

function paymentToDto(doc: PaymentDoc): PaymentDto {
  return {
    id: doc._id.toString(),
    invoiceId: doc.invoiceId.toString(),
    amountPaise: doc.amountPaise,
    method: doc.method,
    reference: doc.reference,
    receiptNumber: doc.receiptNumber,
    receivedByName: doc.receivedByName,
    createdAt: doc.createdAt.toISOString(),
    refunded: doc.refunded,
  };
}

async function clinicHeader(clinicId: service.BillingContext['clinicId']): Promise<ClinicHeaderInfo> {
  const clinic = await ClinicModel.findById(clinicId).lean();
  return { name: clinic?.name ?? 'Clinic', phone: clinic?.phone, email: clinic?.email };
}

export async function createInvoice(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const input = req.body as CreateInvoiceInput;
  const { invoice, discountApplied } = await service.createInvoice(ctx, input);
  await audit(req, {
    action: 'billing.invoice.create',
    resource: 'invoice',
    resourceId: invoice._id.toString(),
    after: { totalPaise: invoice.totalPaise, status: invoice.status },
  });
  if (discountApplied) {
    await audit(req, {
      action: 'billing.discount',
      resource: 'invoice',
      resourceId: invoice._id.toString(),
      reason: invoice.discountReason,
      after: { discountPaise: invoice.discountPaise },
    });
  }
  created(res, invoiceToDto(invoice));
}

export async function listInvoices(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const pagination = parsePagination(req);
  const q = req.query as { patientId?: string; status?: InvoiceStatus; from?: string; to?: string };
  const { items, total } = await service.listInvoices(ctx, {
    patientId: q.patientId,
    status: q.status,
    from: q.from,
    to: q.to,
    skip: pagination.skip,
    limit: pagination.limit,
  });
  ok(res, items.map(invoiceToDto), { page: pagination.page, limit: pagination.limit, total });
}

export async function getInvoice(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const invoice = await service.getInvoiceOrThrow(ctx, req.params.id as string);
  const payments = await service.listPaymentsForInvoice(ctx, invoice._id.toString());
  ok(res, { ...invoiceToDto(invoice), payments: payments.map(paymentToDto) });
}

export async function recordPayments(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const input = req.body as RecordPaymentInput;
  const { invoice, payments } = await service.recordPayments(ctx, req.params.id as string, input);
  await audit(req, {
    action: 'billing.payment.record',
    resource: 'invoice',
    resourceId: invoice._id.toString(),
    after: {
      paidPaise: invoice.paidPaise,
      status: invoice.status,
      receiptNumbers: payments.map((p) => p.receiptNumber),
    },
  });
  created(res, { ...invoiceToDto(invoice), payments: payments.map(paymentToDto) });
}

export async function refundPayment(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const input = req.body as { paymentId: string; amountPaise: number; reason: string };
  const { payment, invoice } = await service.refundPayment(ctx, req.params.id as string, input);
  await audit(req, {
    action: 'billing.refund',
    resource: 'payment',
    resourceId: payment._id.toString(),
    reason: input.reason,
    after: { refundedAmountPaise: payment.refundedAmountPaise, invoiceStatus: invoice.status },
  });
  ok(res, { payment: paymentToDto(payment), invoice: invoiceToDto(invoice) });
}

export async function invoicePdf(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const invoice = await service.getInvoiceOrThrow(ctx, req.params.id as string);
  const payments = await service.listPaymentsForInvoice(ctx, invoice._id.toString());
  const clinic = await clinicHeader(ctx.clinicId);
  buildInvoicePdf(res, clinic, invoice, payments);
}

export async function receiptPdf(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const payment = await service.getPaymentOrThrow(ctx, req.params.id as string);
  const invoice = await service.getInvoiceOrThrow(ctx, payment.invoiceId.toString());
  const clinic = await clinicHeader(ctx.clinicId);
  buildReceiptPdf(res, clinic, payment, invoice);
}

export async function dailyClosing(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const date = (req.query.date as string | undefined) ?? todayInTimezone(ctx.timezone);
  const result = await service.dailyClosing(ctx, date);
  ok(res, result);
}
