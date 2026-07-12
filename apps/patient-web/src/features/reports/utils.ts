import { format, parseISO } from 'date-fns';
import type { PaymentMethod } from '@clinicos/types';

/** Turns a snake_case enum value into a Title Case display label (e.g. "in_consultation" -> "In Consultation"). */
export function titleCase(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Short "d MMM" axis label for an ISO `yyyy-MM-dd` date string; falls back to the raw value if unparsable. */
export function formatAxisDate(iso: string): string {
  try {
    return format(parseISO(iso), 'd MMM');
  } catch {
    return iso;
  }
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
};
