import { MAX_HOLIDAY_DAYS } from "./calendar";
import { parseDate, parseTime } from "./dates";
import type {
  CalendarDefinition,
  DateOverride,
  FixedHolidayRule,
  HijriHolidayRule,
  TimeRange,
  Weekday,
} from "./types";

// Validates calendars read from untrusted JSON, such as a jsonb column.
// Unknown fields are rejected: a typo like "fixedHoliday" would otherwise
// drop every holiday without a sound. Optional fields may be absent or null.

const CALENDAR_FIELDS = [
  "id",
  "name",
  "timeZone",
  "week",
  "ramadanHours",
  "hijriHolidays",
  "fixedHolidays",
  "overrides",
] as const;

/** The last day each Gregorian month can have. February allows the 29th. */
const LAST_DAY_OF_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

type JsonObject = Record<string, unknown>;

function fail(path: string, problem: string): never {
  throw new Error(`Invalid calendar${path === "" ? "" : ` at ${path}`}: ${problem}.`);
}

/** A short, safe rendering of any value for an error message. */
function shown(value: unknown): string {
  let text: string | undefined;
  try {
    text = JSON.stringify(value);
  } catch {
    text = undefined;
  }
  text ??= String(value);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

/** Checks for a plain object. With `fields`, any other key is an error. */
function parseObject(value: unknown, path: string, fields?: readonly string[]): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(path, `expected an object, got ${shown(value)}`);
  }
  const object = value as JsonObject;
  if (fields !== undefined) {
    const unknown = Object.keys(object).find((key) => !fields.includes(key));
    if (unknown !== undefined) {
      fail(path === "" ? unknown : `${path}.${unknown}`, `unknown field. Known fields: ${fields.join(", ")}`);
    }
  }
  return object;
}

function parseList<T>(value: unknown, path: string, parseItem: (item: unknown, path: string) => T): T[] {
  if (!Array.isArray(value)) fail(path, `expected an array, got ${shown(value)}`);
  return value.map((item, index) => parseItem(item, `${path}[${index}]`));
}

function parseText(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(path, `expected a non-empty string, got ${shown(value)}`);
  }
  return value;
}

function parseWholeNumber(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    fail(path, `expected a whole number from ${min} to ${max}, got ${shown(value)}`);
  }
  return value;
}

function parseTimeZone(value: unknown, path: string): string {
  const zone = parseText(value, path);
  // Intl also accepts raw offsets such as "+03:00". They are not IANA zones.
  let valid = !/^[+-]/.test(zone);
  if (valid) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone });
    } catch {
      valid = false;
    }
  }
  if (!valid) fail(path, `expected an IANA time zone such as "Asia/Riyadh", got ${shown(value)}`);
  return zone;
}

function parseClock(value: unknown, path: string): { text: string; minutes: number } {
  if (typeof value === "string") {
    const minutes = parseTime(value);
    if (minutes !== undefined) return { text: value, minutes };
  }
  return fail(path, `expected an "HH:MM" 24-hour time, got ${shown(value)}`);
}

function parseRange(value: unknown, path: string): TimeRange {
  const object = parseObject(value, path, ["start", "end"]);
  const start = parseClock(object.start, `${path}.start`);
  const end = parseClock(object.end, `${path}.end`);
  if (start.minutes >= end.minutes) {
    fail(path, `start must be before end, got ${start.text} to ${end.text}`);
  }
  return { start: start.text, end: end.text };
}

function parseRanges(value: unknown, path: string): TimeRange[] {
  return parseList(value, path, parseRange);
}

function parseWeek(value: unknown, path: string): Partial<Record<Weekday, TimeRange[]>> {
  const object = parseObject(value, path);
  const week: Partial<Record<Weekday, TimeRange[]>> = {};
  for (const [key, hours] of Object.entries(object)) {
    if (!/^[0-6]$/.test(key)) fail(`${path}.${key}`, "unknown weekday. Use 0 (Sunday) to 6 (Saturday)");
    if (hours != null) week[Number(key) as Weekday] = parseRanges(hours, `${path}.${key}`);
  }
  return week;
}

function parseHijriRule(value: unknown, path: string): HijriHolidayRule {
  const object = parseObject(value, path, ["name", "month", "day", "days"]);
  return {
    name: parseText(object.name, `${path}.name`),
    month: parseWholeNumber(object.month, `${path}.month`, 1, 12),
    day: parseWholeNumber(object.day, `${path}.day`, 1, 30),
    days: parseWholeNumber(object.days, `${path}.days`, 1, MAX_HOLIDAY_DAYS),
  };
}

function parseFixedRule(value: unknown, path: string): FixedHolidayRule {
  const object = parseObject(value, path, ["name", "month", "day", "days"]);
  const month = parseWholeNumber(object.month, `${path}.month`, 1, 12);
  const rule: FixedHolidayRule = {
    name: parseText(object.name, `${path}.name`),
    month,
    day: parseWholeNumber(object.day, `${path}.day`, 1, LAST_DAY_OF_MONTH[month - 1] ?? 31),
  };
  if (object.days != null) rule.days = parseWholeNumber(object.days, `${path}.days`, 1, MAX_HOLIDAY_DAYS);
  return rule;
}

function parseOverride(value: unknown, path: string): DateOverride {
  const object = parseObject(value, path, ["date", "hours", "name"]);
  const date = object.date;
  if (typeof date !== "string" || parseDate(date) === undefined) {
    fail(`${path}.date`, `expected a "YYYY-MM-DD" date, got ${shown(date)}`);
  }
  const override: DateOverride = { date, hours: parseRanges(object.hours, `${path}.hours`) };
  if (object.name != null) override.name = parseText(object.name, `${path}.name`);
  return override;
}

/**
 * Checks that a value is a valid calendar and returns a clean copy of it.
 * Throws an Error whose message names the first bad field.
 */
export function parseCalendar(value: unknown): CalendarDefinition {
  const object = parseObject(value, "", CALENDAR_FIELDS);
  const calendar: CalendarDefinition = {
    id: parseText(object.id, "id"),
    name: parseText(object.name, "name"),
    timeZone: parseTimeZone(object.timeZone, "timeZone"),
    week: parseWeek(object.week, "week"),
  };
  if (object.ramadanHours != null) calendar.ramadanHours = parseRanges(object.ramadanHours, "ramadanHours");
  if (object.hijriHolidays != null) {
    calendar.hijriHolidays = parseList(object.hijriHolidays, "hijriHolidays", parseHijriRule);
  }
  if (object.fixedHolidays != null) {
    calendar.fixedHolidays = parseList(object.fixedHolidays, "fixedHolidays", parseFixedRule);
  }
  if (object.overrides != null) calendar.overrides = parseList(object.overrides, "overrides", parseOverride);
  return calendar;
}
