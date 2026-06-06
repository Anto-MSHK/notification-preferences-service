import { DateTime } from "luxon";

export interface QuietHours {
  timezone: string;
  /** Local wall-clock start, minutes since midnight [0, 1440). */
  startMinute: number;
  /** Local wall-clock end, minutes since midnight [0, 1440). */
  endMinute: number;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTimeToMinutes(value: string): number {
  const match = TIME_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid time "${value}", expected HH:mm`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function isValidTimezone(timezone: string): boolean {
  return DateTime.local().setZone(timezone).isValid;
}

/**
 * Returns true when the given instant falls inside the user's quiet window.
 * The window is interpreted in the user's timezone and may wrap past midnight
 * (e.g. 22:00 -> 08:00). A zero-length window (start === end) blocks nothing.
 */
export function isWithinQuietHours(instant: Date, quietHours: QuietHours): boolean {
  const { timezone, startMinute, endMinute } = quietHours;
  if (startMinute === endMinute) {
    return false;
  }

  const local = DateTime.fromJSDate(instant, { zone: timezone });
  if (!local.isValid) {
    throw new Error(`Invalid timezone "${timezone}"`);
  }

  const current = local.hour * 60 + local.minute;
  if (startMinute < endMinute) {
    return current >= startMinute && current < endMinute;
  }
  return current >= startMinute || current < endMinute;
}
