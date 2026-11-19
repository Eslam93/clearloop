import type { Weekday } from "./types";

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** A memo cache is cleared when it reaches this size, so a long-running server stays bounded. */
export const CACHE_LIMIT = 50_000;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(?:([01]\d|2[0-3]):([0-5]\d)|24:00)$/;

// Civil dates are handled as epoch days: whole days since 1970-01-01.
// Date arithmetic is then plain integer arithmetic.

/** Epoch day of a Gregorian date. Unlike `Date.UTC`, it maps years 0 to 99 correctly. */
export function epochDayFromParts(year: number, month: number, day: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime() / DAY_MS;
}

/** "YYYY-MM-DD" for an epoch day. */
export function formatEpochDay(epochDay: number): string {
  const date = new Date(epochDay * DAY_MS);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Epoch day of a "YYYY-MM-DD" date, or undefined if the text is not a real date. */
export function parseDate(text: string): number | undefined {
  const match = DATE_PATTERN.exec(text);
  if (match === null) return undefined;
  const epochDay = epochDayFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
  // The round trip rejects dates such as 2026-02-30, which Date would roll over.
  return formatEpochDay(epochDay) === text ? epochDay : undefined;
}

/** Epoch day of a "YYYY-MM-DD" date. Throws a RangeError for anything else. */
export function toEpochDay(date: string): number {
  const epochDay = typeof date === "string" ? parseDate(date) : undefined;
  if (epochDay === undefined) {
    throw new RangeError(`Expected a "YYYY-MM-DD" date, got ${JSON.stringify(date)}.`);
  }
  return epochDay;
}

/** Minutes after midnight for "HH:MM", or undefined. "24:00" is 1440, the end of the day. */
export function parseTime(text: string): number | undefined {
  const match = TIME_PATTERN.exec(text);
  if (match === null) return undefined;
  if (match[1] === undefined) return 24 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Minutes after midnight for "HH:MM". Throws a RangeError for anything else. */
export function toMinutes(time: string): number {
  const minutes = typeof time === "string" ? parseTime(time) : undefined;
  if (minutes === undefined) {
    throw new RangeError(`Expected an "HH:MM" 24-hour time, got ${JSON.stringify(time)}.`);
  }
  return minutes;
}

/** Weekday of an epoch day. 1970-01-01 was a Thursday. */
export function weekdayOf(epochDay: number): Weekday {
  return ((((epochDay + 4) % 7) + 7) % 7) as Weekday;
}

/** Gregorian month (1 to 12) and day of an epoch day. */
export function monthDayOf(epochDay: number): { month: number; day: number } {
  const date = new Date(epochDay * DAY_MS);
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** Throws a RangeError unless the value is a finite number of epoch milliseconds. */
export function assertInstant(value: number, name: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number of epoch milliseconds, got ${String(value)}.`);
  }
}
