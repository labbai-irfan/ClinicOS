import { format, isValid, parseISO } from 'date-fns';
import type { AppointmentDto } from '@clinicos/types';

/** Splits an "HH:MM" (24h) string into numeric parts. Tolerant of malformed input. */
function parseTime(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':');
  return { hours: Number(h ?? 0), minutes: Number(m ?? 0) };
}

/** Subtracts minutes from an "HH:MM" (24h) string, wrapping across midnight. */
export function subtractMinutesFromTime(time: string, minutes: number): string {
  const { hours, minutes: mins } = parseTime(time);
  const total = (((hours * 60 + mins - minutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Adds minutes to an "HH:MM" (24h) string, wrapping across midnight. */
export function addMinutesToTime(time: string, minutes: number): string {
  return subtractMinutesFromTime(time, -minutes);
}

/** Formats an "HH:MM" (24h) string as a friendly 12-hour label, e.g. "09:05" -> "9:05 AM". */
export function formatTimeLabel(time: string): string {
  const { hours, minutes } = parseTime(time);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Recommended arrival is a courtesy estimate — roughly ten minutes before the appointment
 * window opens — never an exact consultation time (spec: windows, not promises). Prefers a
 * server-computed value when the API supplies one, otherwise computes it client-side.
 */
export function recommendedArrivalLabel(
  appointment: Pick<AppointmentDto, 'windowStart' | 'recommendedArrival'>,
): string {
  if (appointment.recommendedArrival) {
    const parsed = parseISO(appointment.recommendedArrival);
    if (isValid(parsed)) return format(parsed, 'h:mm a');
  }
  return formatTimeLabel(subtractMinutesFromTime(appointment.windowStart, 10));
}
