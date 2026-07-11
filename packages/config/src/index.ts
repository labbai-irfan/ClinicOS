export const APP_NAME = 'ClinicOS';

export const DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  TIMEZONE: 'Asia/Kolkata',
  CURRENCY: 'INR',
  APPOINTMENT_WINDOW_MINUTES: 20,
  APPOINTMENT_BUFFER_MINUTES: 5,
  AVG_CONSULTATION_MINUTES: 12,
  AVG_NURSE_ASSESSMENT_MINUTES: 6,
  TOKEN_PREFIX: 'A',
  TOKEN_PAD: 3,
  WAIT_ESTIMATE_SPREAD_RATIO: 0.3,
  REJOIN_POLICY: 'after_next_patient',
  MAX_UPLOAD_MB: 15,
  ALLOWED_UPLOAD_MIME: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
} as const;

/** Format integer paise as a display currency string (₹1,234.50). */
export function formatMoney(amountPaise: number, currency = '₹'): string {
  const rupees = amountPaise / 100;
  return `${currency}${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Build a token label from prefix + padded number, e.g. A-007 or DR1-015. */
export function formatToken(prefix: string, value: number, pad: number = DEFAULTS.TOKEN_PAD): string {
  return `${prefix}-${String(value).padStart(pad, '0')}`;
}

export function computeAge(dateOfBirth?: string | Date | null, approximateAge?: number | null): number | undefined {
  if (dateOfBirth) {
    const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
    if (!Number.isNaN(dob.getTime())) {
      const diff = Date.now() - dob.getTime();
      return Math.max(0, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
    }
  }
  return approximateAge ?? undefined;
}
