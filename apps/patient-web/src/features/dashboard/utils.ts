import type { PaymentMethod } from '@clinicos/types';

/** Time-of-day greeting based on the viewer's current local time. */
export function timeOfDayGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
};

/**
 * Renders the average wait as an approximate band rather than a single exact
 * figure — the backend estimate is itself an average, so presenting one decimal
 * number would read as more precise than it is. Returns "No data yet" when the
 * backend has nothing to estimate from (no completed waits today).
 */
export function formatWaitRange(avgWaitMinutes: number | null): string {
  if (avgWaitMinutes === null) return 'No data yet';
  if (avgWaitMinutes <= 2) return 'Under 5 min';
  const spread = Math.max(3, Math.round(avgWaitMinutes * 0.25));
  const low = Math.max(0, Math.round(avgWaitMinutes - spread));
  const high = Math.round(avgWaitMinutes + spread);
  return `~${low}–${high} min`;
}
