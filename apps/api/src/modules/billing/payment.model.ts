import { Schema, model, type Types } from 'mongoose';
import type { PaymentMethod } from '@clinicos/types';
import { tenantBase, type TenantFields } from '../../database/plugins';

export interface PaymentDoc extends TenantFields {
  _id: Types.ObjectId;
  invoiceId: Types.ObjectId;
  amountPaise: number;
  method: PaymentMethod;
  reference?: string;
  receiptNumber: string;
  receivedByUserId: Types.ObjectId;
  receivedByName: string;
  refunded: boolean;
  refundedAmountPaise: number;
}

const paymentSchema = new Schema<PaymentDoc>(
  {
    invoiceId: { type: Schema.Types.ObjectId, required: true, index: true },
    amountPaise: { type: Number, required: true, min: 0 },
    method: { type: String, required: true },
    reference: String,
    receiptNumber: { type: String, required: true },
    receivedByUserId: { type: Schema.Types.ObjectId, required: true },
    receivedByName: { type: String, required: true, trim: true },
    refunded: { type: Boolean, default: false },
    refundedAmountPaise: { type: Number, required: true, min: 0, default: 0 },
  },
  { collection: 'payments' },
);

paymentSchema.plugin(tenantBase);

// Invoice payment history, and the daily-closing aggregation (clinic + date range).
paymentSchema.index({ clinicId: 1, invoiceId: 1, createdAt: -1 });
paymentSchema.index({ clinicId: 1, createdAt: -1 });
// receiptNumber is only unique per clinic — the sequence counter resets per clinic per year.
paymentSchema.index({ clinicId: 1, receiptNumber: 1 }, { unique: true });

export const PaymentModel = model<PaymentDoc>('Payment', paymentSchema);
