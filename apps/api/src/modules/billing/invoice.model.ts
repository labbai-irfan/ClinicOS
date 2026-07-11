import { Schema, model, type Types } from 'mongoose';
import type { BillingItemType, InvoiceStatus } from '@clinicos/types';
import { tenantBase, type TenantFields } from '../../database/plugins';

export interface InvoiceItem {
  description: string;
  type: BillingItemType;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
}

export interface InvoiceDoc extends TenantFields {
  _id: Types.ObjectId;
  invoiceNumber: string;
  patientId: Types.ObjectId;
  queueEntryId?: Types.ObjectId;
  emergencyCaseId?: Types.ObjectId;
  items: InvoiceItem[];
  subtotalPaise: number;
  discountPaise: number;
  discountReason?: string;
  totalPaise: number;
  paidPaise: number;
  refundedPaise: number;
  status: InvoiceStatus;
  deferred: boolean;
}

const invoiceItemSchema = new Schema<InvoiceItem>(
  {
    description: { type: String, required: true, trim: true },
    type: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPricePaise: { type: Number, required: true, min: 0 },
    totalPaise: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const invoiceSchema = new Schema<InvoiceDoc>(
  {
    invoiceNumber: { type: String, required: true },
    patientId: { type: Schema.Types.ObjectId, required: true, index: true },
    queueEntryId: { type: Schema.Types.ObjectId },
    emergencyCaseId: { type: Schema.Types.ObjectId },
    items: { type: [invoiceItemSchema], required: true, default: [] },
    subtotalPaise: { type: Number, required: true, min: 0 },
    discountPaise: { type: Number, required: true, min: 0, default: 0 },
    discountReason: String,
    totalPaise: { type: Number, required: true, min: 0 },
    paidPaise: { type: Number, required: true, min: 0, default: 0 },
    refundedPaise: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, required: true, index: true },
    deferred: { type: Boolean, default: false },
  },
  { collection: 'invoices' },
);

invoiceSchema.plugin(tenantBase);

// Patient billing history and clinic invoice listings are the primary read paths.
invoiceSchema.index({ clinicId: 1, patientId: 1, createdAt: -1 });
invoiceSchema.index({ clinicId: 1, status: 1, createdAt: -1 });
// invoiceNumber is only unique per clinic — the sequence counter resets per clinic per year.
invoiceSchema.index({ clinicId: 1, invoiceNumber: 1 }, { unique: true });

export const InvoiceModel = model<InvoiceDoc>('Invoice', invoiceSchema);
