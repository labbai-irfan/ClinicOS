import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { randomBytes } from 'crypto';
import { authed, createTestClinic } from '../../test/helpers';
import { PaymentModel } from './payment.model';

function patientId(): string {
  return new Types.ObjectId().toString();
}

function idempotencyKey(): string {
  return `test-${randomBytes(8).toString('hex')}`;
}

interface CreateInvoiceOptions {
  discountPaise?: number;
  discountReason?: string;
  deferred?: boolean;
  finalize?: boolean;
}

async function createInvoice(
  api: ReturnType<typeof authed>,
  unitPricePaise: number,
  options: CreateInvoiceOptions = {},
  setIdempotencyKey = false,
) {
  const req = api
    .post('/api/v1/billing/invoices');

  if (setIdempotencyKey) {
    req.set('Idempotency-Key', idempotencyKey());
  }

  return req.send({
    patientId: patientId(),
    items: [
      { description: 'Consultation fee', type: 'consultation', quantity: 1, unitPricePaise },
      { description: 'Dressing', type: 'dressing', quantity: 2, unitPricePaise: 5000 },
    ],
    ...options,
  });
}

describe('billing', () => {
  it('computes subtotal, discount and total correctly on create', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.clinic_owner);

    const res = await createInvoice(api, 50000, { discountPaise: 5000, discountReason: 'Loyal patient' });

    expect(res.status).toBe(201);
    // subtotal = 50000 + (2 * 5000) = 60000
    expect(res.body.data.subtotalPaise).toBe(60000);
    expect(res.body.data.discountPaise).toBe(5000);
    expect(res.body.data.totalPaise).toBe(55000);
    expect(res.body.data.status).toBe('unpaid');
    expect(res.body.data.paidPaise).toBe(0);
    expect(res.body.data.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
  });

  it('rejects a discount from a role without BILLING_DISCOUNT permission', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.receptionist);

    const res = await createInvoice(api, 50000, { discountPaise: 5000, discountReason: 'Because' });

    expect(res.status).toBe(403);
  });

  it('creates a deferred invoice as unpaid for emergency deferred billing', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.receptionist);

    const res = await createInvoice(api, 50000, { deferred: true, finalize: false });

    expect(res.status).toBe(201);
    expect(res.body.data.deferred).toBe(true);
    expect(res.body.data.status).toBe('unpaid');
  });

  it('creates a draft invoice when not finalized and not deferred', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.receptionist);

    const res = await createInvoice(api, 50000, { finalize: false });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
  });

  it('records a partial payment and marks the invoice partially_paid', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.receptionist);

    const invoiceRes = await createInvoice(api, 50000);
    const invoiceId = invoiceRes.body.data.id;
    // total = 60000

    const res = await api.post(`/api/v1/billing/invoices/${invoiceId}/payments`).send({
      payments: [{ method: 'cash', amountPaise: 20000 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('partially_paid');
    expect(res.body.data.paidPaise).toBe(20000);
    expect(res.body.data.payments).toHaveLength(1);
    expect(res.body.data.payments[0].receiptNumber).toMatch(/^RCPT-\d{4}-\d{6}$/);

    const detail = await api.get(`/api/v1/billing/invoices/${invoiceId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.payments).toHaveLength(1);
    expect(detail.body.data.items).toHaveLength(2);
  });

  it('rejects a payment that exceeds the amount due', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.receptionist);

    const invoiceRes = await createInvoice(api, 50000);
    const invoiceId = invoiceRes.body.data.id;

    const res = await api.post(`/api/v1/billing/invoices/${invoiceId}/payments`).send({
      payments: [{ method: 'cash', amountPaise: 999999 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAYMENT_EXCEEDS_DUE');
  });

  it('marks the invoice paid once payments cover the full due amount', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.receptionist);

    const invoiceRes = await createInvoice(api, 50000);
    const invoiceId = invoiceRes.body.data.id;

    const res = await api.post(`/api/v1/billing/invoices/${invoiceId}/payments`).send({
      payments: [
        { method: 'cash', amountPaise: 30000 },
        { method: 'upi', amountPaise: 30000 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('paid');
    expect(res.body.data.paidPaise).toBe(60000);
    expect(res.body.data.payments).toHaveLength(2);
  });

  it('refunds a payment, requires a reason, and updates payment and invoice balances', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.clinic_owner);

    const invoiceRes = await createInvoice(api, 50000);
    const invoiceId = invoiceRes.body.data.id;
    const payRes = await api.post(`/api/v1/billing/invoices/${invoiceId}/payments`).send({
      payments: [{ method: 'cash', amountPaise: 60000 }],
    });
    const paymentId = payRes.body.data.payments[0].id;

    const missingReason = await api.post(`/api/v1/billing/payments/${paymentId}/refund`).send({
      paymentId,
      amountPaise: 10000,
    });
    expect(missingReason.status).toBe(400);

    const res = await api.post(`/api/v1/billing/payments/${paymentId}/refund`).send({
      paymentId,
      amountPaise: 15000,
      reason: 'Patient overcharged',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.payment.refunded).toBe(false);
    expect(res.body.data.invoice.refundedPaise).toBe(15000);
    expect(res.body.data.invoice.status).not.toBe('refunded');

    const fullRefund = await api.post(`/api/v1/billing/payments/${paymentId}/refund`).send({
      paymentId,
      amountPaise: 45000,
      reason: 'Full refund requested',
    });
    expect(fullRefund.status).toBe(200);
    expect(fullRefund.body.data.payment.refunded).toBe(true);
    expect(fullRefund.body.data.invoice.refundedPaise).toBe(60000);
    expect(fullRefund.body.data.invoice.status).toBe('refunded');
  });

  it('aggregates daily closing totals by payment method', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.receptionist);

    const invoiceA = await createInvoice(api, 50000);
    await api.post(`/api/v1/billing/invoices/${invoiceA.body.data.id}/payments`).send({
      payments: [{ method: 'cash', amountPaise: 60000 }],
    });

    const invoiceB = await createInvoice(api, 20000);
    await api.post(`/api/v1/billing/invoices/${invoiceB.body.data.id}/payments`).send({
      payments: [{ method: 'upi', amountPaise: 30000 }],
    });

    const res = await api.get('/api/v1/billing/daily-closing');

    expect(res.status).toBe(200);
    expect(res.body.data.totalPaise).toBe(90000);
    expect(res.body.data.paymentCount).toBe(2);
    expect(res.body.data.invoiceCount).toBe(2);
    const cash = res.body.data.byMethod.find((m: { method: string }) => m.method === 'cash');
    const upi = res.body.data.byMethod.find((m: { method: string }) => m.method === 'upi');
    expect(cash.totalPaise).toBe(60000);
    expect(upi.totalPaise).toBe(30000);
  });

  it('replays an idempotent payment request without double-charging', async () => {
    const clinic = await createTestClinic();
    const api = authed(clinic.app, clinic.tokens.clinic_owner);

    const invoiceRes = await createInvoice(api, 50000, {}, false);
    const invoiceId = invoiceRes.body.data.id;
    const idempotencyKey = `test-key-${new Types.ObjectId().toString()}`;

    const body = { payments: [{ method: 'cash', amountPaise: 60000 }] };

    const first = await api
      .post(`/api/v1/billing/invoices/${invoiceId}/payments`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);
    expect(first.status).toBe(201);

    const second = await api
      .post(`/api/v1/billing/invoices/${invoiceId}/payments`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);
    expect(second.status).toBe(201);
    expect(second.body.data.paidPaise).toBe(60000);
    expect(second.body.data.payments).toHaveLength(1);

    const count = await PaymentModel.countDocuments({ invoiceId: new Types.ObjectId(invoiceId) });
    expect(count).toBe(1);
  });
});
