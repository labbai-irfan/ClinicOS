import { z } from 'zod';
import { BILLING_ITEM_TYPES, PAYMENT_METHODS } from '@clinicos/types';
import { amountPaise, nonEmptyText, objectId, optionalText } from './common';

const invoiceItem = z.object({
  description: nonEmptyText(240),
  type: z.enum(BILLING_ITEM_TYPES),
  quantity: z.number().int().min(1).max(999).default(1),
  unitPricePaise: amountPaise,
});

export const createInvoiceSchema = z.object({
  patientId: objectId,
  queueEntryId: objectId.optional(),
  emergencyCaseId: objectId.optional(),
  items: z.array(invoiceItem).min(1).max(50),
  discountPaise: amountPaise.default(0),
  discountReason: optionalText(300),
  deferred: z.boolean().default(false),
  finalize: z.boolean().default(true),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const recordPaymentSchema = z.object({
  payments: z
    .array(
      z.object({
        method: z.enum(PAYMENT_METHODS),
        amountPaise: amountPaise.refine((v) => v > 0, 'Amount must be positive'),
        reference: optionalText(120),
      }),
    )
    .min(1)
    .max(4),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const refundSchema = z.object({
  paymentId: objectId,
  amountPaise: amountPaise.refine((v) => v > 0, 'Amount must be positive'),
  reason: nonEmptyText(500),
});

export const discountSchema = z.object({
  discountPaise: amountPaise,
  reason: nonEmptyText(500),
});
