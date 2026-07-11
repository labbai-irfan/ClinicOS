/** Timezone helpers — timestamps are stored UTC; clinic days are computed in the clinic's IANA timezone. */

function tzOffsetMs(timezone: string, utc: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(utc)) parts[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '0' : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utc.getTime();
}

/** UTC instant for a wall-clock time in a timezone. */
export function zonedTimeToUtc(
  timezone: string,
  y: number,
  m: number,
  d: number,
  hh = 0,
  mm = 0,
): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  return new Date(guess - tzOffsetMs(timezone, new Date(guess)));
}

/** Current local calendar date (YYYY-MM-DD) in a timezone. */
export function todayInTimezone(timezone: string, now = new Date()): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dtf.format(now);
}

/** UTC [start, end) range covering one local calendar date in a timezone. */
export function dayRangeUtc(timezone: string, localDate: string): { start: Date; end: Date } {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const start = zonedTimeToUtc(timezone, y, m, d, 0, 0);
  const end = new Date(start.getTime() + 26 * 3600 * 1000);
  const endExact = zonedTimeToUtc(timezone, y, m, d + 1, 0, 0);
  return { start, end: Number.isNaN(endExact.getTime()) ? end : endExact };
}

/** Combine a local date + HH:mm into a UTC instant for a timezone. */
export function localDateTimeToUtc(timezone: string, localDate: string, time: string): Date {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  return zonedTimeToUtc(timezone, y, m, d, hh, mm);
}
