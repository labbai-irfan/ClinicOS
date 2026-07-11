import { Types, type HydratedDocument } from 'mongoose';
import type { InvoiceStatus, Permission, PaymentMethod } from '@clinicos/types';
import { PERMISSIONS, ERROR_CODES } from '@clinicos/types';
import type { CreateInvoiceInput, RecordPaymentInput } from '@clinicos/validation';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { nextSequence } from '../../shared/sequence';
import { todayInTimezone, dayRangeUtc } from '../../shared/dates';
import { InvoiceModel, type InvoiceDoc, type InvoiceItem } from './invoice.model';
import { PaymentModel, type PaymentDoc } from './payment.model';

/** Hydrated (has `.save()` etc.) — used wherever a document is mutated after loading. */
type InvoiceHydrated = HydratedDocument<InvoiceDoc>;
type PaymentHydrated = HydratedDocument<PaymentDoc>;

/**
 * Tenant + actor scoping context, resolved by `tenantContext`/`authenticate` middleware —
 * NEVER built from client input (clinicId/branchId/userId are always server-resolved).
 */
export interface BillingContext {
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  branchId: Types.ObjectId;
  timezone: string;
  permissions: ReadonlySet<Permission>;
  userId: Types.ObjectId;
  userName: string;
}

export interface RefundInput {
  paymentId: string;
  amountPaise: number;
  reason: string;
}

export interface InvoiceListQuery {
  patientId?: string;
  status?: InvoiceStatus;
  from?: string;
  to?: string;
  skip: number;
  limit: number;
}

export interface DailyClosingMethodSummary {
  method: PaymentMethod;
  totalPaise: number;
  paymentCount: number;
  invoiceCount: number;
}

export interface DailyClosingResult {
  date: string;
  totalPaise: number;
  paymentCount: number;
  invoiceCount: number;
  byMethod: DailyClosingMethodSummary[];
}

function currentYear(ctx: BillingContext): string {
  return todayInTimezone(ctx.timezone).slice(0, 4);
}

/** Scope key: `invoice:<clinicId>:<YYYY>` — resets the counter each calendar year per clinic. */
async function nextInvoiceNumber(ctx: BillingContext): Promise<string> {
  const year = currentYear(ctx);
  const seq = await nextSequence(`invoice:${ctx.clinicId.toString()}:${year}`);
  return `INV-${year}-${String(seq).padStart(6, '0')}`;
}

/** Scope key: `receipt:<clinicId>:<YYYY>` — resets the counter each calendar year per clinic. */
async function nextReceiptNumber(ctx: BillingContext): Promise<string> {
  const year = currentYear(ctx);
  const seq = await nextSequence(`receipt:${ctx.clinicId.toString()}:${year}`);
  return `RCPT-${year}-${String(seq).padStart(6, '0')}`;
}

export interface CreateInvoiceResult {
  invoice: InvoiceHydrated;
  discountApplied: boolean;
}

/**
 * Creates an invoice. Totals are always computed server-side from the submitted line
 * items — never trusted from the client. Applying a discount requires the extra
 * BILLING_DISCOUNT permission (checked here, not just at the route level) and a reason.
 */
export async function createInvoice(
  ctx: BillingContext,
  input: CreateInvoiceInput,
): Promise<CreateInvoiceResult> {
  const items: InvoiceItem[] = input.items.map((item) => ({
    description: item.description,
    type: item.type,
    quantity: item.quantity,
    unitPricePaise: item.unitPricePaise,
    totalPaise: item.quantity * item.unitPricePaise,
  }));
  const subtotalPaise = items.reduce((sum, item) => sum + item.totalPaise, 0);

  const discountPaise = input.discountPaise;
  const discountApplied = discountPaise > 0;
  if (discountApplied) {
    if (!ctx.permissions.has(PERMISSIONS.BILLING_DISCOUNT)) {
      throw new ForbiddenError('You do not have permission to apply a billing discount.');
    }
    if (!input.discountReason) {
      throw new ValidationError([
        { field: 'discountReason', message: 'A reason is required when applying a discount.' },
      ]);
    }
  }

  const totalPaise = Math.max(0, subtotalPaise - discountPaise);
  const status: InvoiceStatus = input.deferred || input.finalize ? 'unpaid' : 'draft';

  const invoiceNumber = await nextInvoiceNumber(ctx);
  const invoice = await InvoiceModel.create({
    organizationId: ctx.organizationId,
    clinicId: ctx.clinicId,
    branchId: ctx.branchId,
    invoiceNumber,
    patientId: new Types.ObjectId(input.patientId),
    queueEntryId: input.queueEntryId ? new Types.ObjectId(input.queueEntryId) : undefined,
    emergencyCaseId: input.emergencyCaseId ? new Types.ObjectId(input.emergencyCaseId) : undefined,
    items,
    subtotalPaise,
    discountPaise,
    discountReason: discountApplied ? input.discountReason : undefined,
    totalPaise,
    paidPaise: 0,
    refundedPaise: 0,
    status,
    deferred: input.deferred,
  });

  return { invoice, discountApplied };
}

export async function listInvoices(
  ctx: BillingContext,
  query: InvoiceListQuery,
): Promise<{ items: InvoiceHydrated[]; total: number }> {
  const filter: Record<string, unknown> = { clinicId: ctx.clinicId, deletedAt: null };
  if (query.patientId) filter.patientId = new Types.ObjectId(query.patientId);
  if (query.status) filter.status = query.status;
  if (query.from || query.to) {
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = new Date(query.from);
    if (query.to) range.$lte = new Date(query.to);
    filter.createdAt = range;
  }

  const [items, total] = await Promise.all([
    InvoiceModel.find(filter).sort({ createdAt: -1 }).skip(query.skip).limit(query.limit),
    InvoiceModel.countDocuments(filter),
  ]);
  return { items, total };
}

export async function getInvoiceOrThrow(ctx: BillingContext, id: string): Promise<InvoiceHydrated> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Invoice');
  const invoice = await InvoiceModel.findOne({ _id: id, clinicId: ctx.clinicId, deletedAt: null });
  if (!invoice) throw new NotFoundError('Invoice');
  return invoice;
}

export async function listPaymentsForInvoice(
  ctx: BillingContext,
  invoiceId: string,
): Promise<PaymentHydrated[]> {
  return PaymentModel.find({
    clinicId: ctx.clinicId,
    invoiceId: new Types.ObjectId(invoiceId),
    deletedAt: null,
  }).sort({ createdAt: 1 });
}

export async function getPaymentOrThrow(ctx: BillingContext, id: string): Promise<PaymentHydrated> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Payment');
  const payment = await PaymentModel.findOne({ _id: id, clinicId: ctx.clinicId, deletedAt: null });
  if (!payment) throw new NotFoundError('Payment');
  return payment;
}

export interface RecordPaymentsResult {
  invoice: InvoiceHydrated;
  payments: PaymentHydrated[];
}

/**
 * Records one payment document per method in the request. Rejects the whole batch if
 * the combined amount would exceed the invoice's remaining due balance. This is the
 * single most important idempotency point in the app — the route wraps this with the
 * `idempotent()` middleware so a retried request never double-charges.
 */
export async function recordPayments(
  ctx: BillingContext,
  invoiceId: string,
  input: RecordPaymentInput,
): Promise<RecordPaymentsResult> {
  const invoice = await getInvoiceOrThrow(ctx, invoiceId);
  const due = invoice.totalPaise - invoice.paidPaise;
  const sum = input.payments.reduce((total, p) => total + p.amountPaise, 0);
  if (sum > due) {
    throw new AppError(
      400,
      ERROR_CODES.PAYMENT_EXCEEDS_DUE,
      'Payment amount exceeds the amount due on this invoice.',
    );
  }

  const payments: PaymentHydrated[] = [];
  for (const p of input.payments) {
    const receiptNumber = await nextReceiptNumber(ctx);
    // eslint-disable-next-line no-await-in-loop -- receipt numbers must be issued in order
    const payment = await PaymentModel.create({
      organizationId: ctx.organizationId,
      clinicId: ctx.clinicId,
      branchId: ctx.branchId,
      invoiceId: invoice._id,
      amountPaise: p.amountPaise,
      method: p.method,
      reference: p.reference,
      receiptNumber,
      receivedByUserId: ctx.userId,
      receivedByName: ctx.userName,
    });
    payments.push(payment);
  }

  invoice.paidPaise += sum;
  invoice.status = invoice.paidPaise >= invoice.totalPaise ? 'paid' : 'partially_paid';
  await invoice.save();

  return { invoice, payments };
}

export interface RefundResult {
  payment: PaymentHydrated;
  invoice: InvoiceHydrated;
}

/**
 * Refunds part or all of a previously recorded payment. The refunded amount can never
 * exceed what remains un-refunded on that payment.
 */
export async function refundPayment(
  ctx: BillingContext,
  paymentId: string,
  input: RefundInput,
): Promise<RefundResult> {
  const payment = await getPaymentOrThrow(ctx, paymentId);

  const refundable = payment.amountPaise - payment.refundedAmountPaise;
  if (input.amountPaise > refundable) {
    throw new AppError(
      400,
      ERROR_CODES.PAYMENT_EXCEEDS_DUE,
      'Refund amount exceeds the refundable balance on this payment.',
    );
  }

  payment.refundedAmountPaise += input.amountPaise;
  payment.refunded = payment.refundedAmountPaise >= payment.amountPaise;
  await payment.save();

  const invoice = await getInvoiceOrThrow(ctx, payment.invoiceId.toString());
  invoice.refundedPaise += input.amountPaise;
  if (invoice.refundedPaise >= invoice.paidPaise) invoice.status = 'refunded';
  await invoice.save();

  return { payment, invoice };
}

/** Aggregates the clinic's payments for one local calendar day, grouped by method. */
export async function dailyClosing(ctx: BillingContext, localDate: string): Promise<DailyClosingResult> {
  const { start, end } = dayRangeUtc(ctx.timezone, localDate);
  const payments = await PaymentModel.find({
    clinicId: ctx.clinicId,
    deletedAt: null,
    createdAt: { $gte: start, $lt: end },
  }).lean();

  interface Bucket {
    totalPaise: number;
    paymentCount: number;
    invoiceIds: Set<string>;
  }
  const byMethodMap = new Map<PaymentMethod, Bucket>();
  const allInvoiceIds = new Set<string>();
  let totalPaise = 0;

  for (const payment of payments) {
    totalPaise += payment.amountPaise;
    allInvoiceIds.add(payment.invoiceId.toString());
    const bucket = byMethodMap.get(payment.method) ?? {
      totalPaise: 0,
      paymentCount: 0,
      invoiceIds: new Set<string>(),
    };
    bucket.totalPaise += payment.amountPaise;
    bucket.paymentCount += 1;
    bucket.invoiceIds.add(payment.invoiceId.toString());
    byMethodMap.set(payment.method, bucket);
  }

  const byMethod: DailyClosingMethodSummary[] = Array.from(byMethodMap.entries()).map(
    ([method, bucket]) => ({
      method,
      totalPaise: bucket.totalPaise,
      paymentCount: bucket.paymentCount,
      invoiceCount: bucket.invoiceIds.size,
    }),
  );

  return {
    date: localDate,
    totalPaise,
    paymentCount: payments.length,
    invoiceCount: allInvoiceIds.size,
    byMethod,
  };
}
