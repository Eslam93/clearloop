// Test helpers. They read Intl directly, so expectations do not depend on the
// conversions the library itself uses.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Epoch milliseconds for an ISO 8601 timestamp with an explicit offset. */
export function at(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Bad timestamp in a test: ${iso}`);
  return ms;
}

/** The interval [start, end) between two local wall times on one date, given with their offset. */
export function span(date: string, start: string, end: string, offset: string): { start: number; end: number } {
  return { start: at(`${date}T${start}${offset}`), end: at(`${date}T${end}${offset}`) };
}

/** "YYYY-MM-DD" plus a number of days. */
export function addDays(date: string, days: number): string {
  return new Date(at(`${date}T00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/** Every date from `first` to `last`, inclusive. */
export function datesBetween(first: string, last: string): string[] {
  const dates: string[] = [];
  for (let date = first; date <= last; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** Weekday of a "YYYY-MM-DD" date. 0 is Sunday. */
export function weekdayOf(date: string): number {
  return new Date(at(`${date}T12:00Z`)).getUTCDay();
}

const wallFormatters = new Map<string, Intl.DateTimeFormat>();
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** "YYYY-MM-DD HH:MM" wall time of an instant in a time zone. */
export function wallTime(instant: number, timeZone: string): string {
  let formatter = wallFormatters.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    wallFormatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** UTC offset in minutes at an instant, read from Intl's "GMT+03:00" style zone name. */
export function offsetMinutes(instant: number, timeZone: string): number {
  let formatter = offsetFormatters.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" });
    offsetFormatters.set(timeZone, formatter);
  }
  const name = formatter.formatToParts(instant).find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(name);
  if (match === null) throw new Error(`Unexpected zone name "${name}".`);
  if (match[1] === undefined) return 0;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}
