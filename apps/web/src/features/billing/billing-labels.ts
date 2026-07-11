import type { BillingItemType, InvoiceStatus, PaymentMethod } from '@clinicos/types';
import type { StatusTone } from '../../components/ui/StatusPill';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  unpaid: 'Unpaid',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  refunded: 'Refunded',
  waived: 'Waived',
  cancelled: 'Cancelled',
};

/** StatusPill tone per spec §24: paid success, partially paid warning, unpaid neutral,
 *  refunded info, cancelled danger, waived neutral. Never relies on color alone —
 *  StatusPill always pairs the tone with an icon and the text label. */
export const INVOICE_STATUS_TONE: Record<InvoiceStatus, StatusTone> = {
  draft: 'neutral',
  unpaid: 'neutral',
  partially_paid: 'warning',
  paid: 'success',
  refunded: 'info',
  waived: 'neutral',
  cancelled: 'danger',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
};

export const BILLING_ITEM_TYPE_LABELS: Record<BillingItemType, string> = {
  consultation: 'Consultation',
  follow_up: 'Follow-up',
  procedure: 'Procedure',
  dressing: 'Dressing',
  injection: 'Injection',
  test: 'Test',
  other: 'Other',
};
