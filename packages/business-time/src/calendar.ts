import { monthDayOf, toEpochDay, toMinutes, weekdayOf } from "./dates";
import { hijriDateOfEpochDay } from "./hijri";
import { instantAt } from "./time-zone";
import type { CalendarDefinition, Interval, TimeRange, Weekday } from "./types";

/** The longest holiday a rule may describe, in days. */
export const MAX_HOLIDAY_DAYS = 366;

/** Minutes after local midnight, half-open: [start, end). */
type MinuteRange = readonly [start: number, end: number];

interface DayRule {
  readonly month: number;
  readonly day: number;
  readonly days: number;
}

/**
 * A calendar with its times and dates parsed, ready for day-by-day lookups.
 * It is rebuilt on every call, so edits to a calendar object are always seen.
 */
export interface CompiledCalendar {
  readonly id: string;
  readonly timeZone: string;
  /** Indexed by weekday, 0 to 6. */
  readonly week: readonly (readonly MinuteRange[])[];
  readonly ramadanHours: readonly MinuteRange[] | undefined;
  readonly fixedHolidays: readonly DayRule[];
  readonly hijriHolidays: readonly DayRule[];
  readonly longestFixed: number;
  readonly longestHijri: number;
  /** Keyed by epoch day. */
  readonly overrides: ReadonlyMap<number, readonly MinuteRange[]>;
}

const CLOSED: readonly MinuteRange[] = [];

function toMinuteRanges(ranges: readonly TimeRange[]): MinuteRange[] {
  return ranges.map((range): MinuteRange => {
    const start = toMinutes(range.start);
    const end = toMinutes(range.end);
    if (start >= end) {
      throw new RangeError(`Time range ${range.start}-${range.end} must start before it ends.`);
    }
    return [start, end];
  });
}

function toDayRule(rule: { name: string; month: number; day: number; days?: number }): DayRule {
  const days = rule.days ?? 1;
  if (!Number.isInteger(days) || days < 1 || days > MAX_HOLIDAY_DAYS) {
    throw new RangeError(
      `Holiday "${rule.name}" must last a whole number of days from 1 to ${MAX_HOLIDAY_DAYS}, got ${days}.`,
    );
  }
  return { month: rule.month, day: rule.day, days };
}

export function compileCalendar(cal: CalendarDefinition): CompiledCalendar {
  const week: MinuteRange[][] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    week.push(toMinuteRanges(cal.week[weekday as Weekday] ?? []));
  }

  const overrides = new Map<number, readonly MinuteRange[]>();
  for (const override of cal.overrides ?? []) {
    // A later override for the same date replaces an earlier one.
    overrides.set(toEpochDay(override.date), toMinuteRanges(override.hours));
  }

  const fixedHolidays = (cal.fixedHolidays ?? []).map(toDayRule);
  const hijriHolidays = (cal.hijriHolidays ?? []).map(toDayRule);

  return {
    id: cal.id,
    timeZone: cal.timeZone,
    week,
    ramadanHours: cal.ramadanHours == null ? undefined : toMinuteRanges(cal.ramadanHours),
    fixedHolidays,
    hijriHolidays,
    longestFixed: Math.max(0, ...fixedHolidays.map((rule) => rule.days)),
    longestHijri: Math.max(0, ...hijriHolidays.map((rule) => rule.days)),
    overrides,
  };
}

/**
 * A date is a holiday when a rule's date falls on it or on one of the
 * `days - 1` dates before it. So a rule can spill into the next month.
 */
function isHoliday(c: CompiledCalendar, epochDay: number): boolean {
  for (let back = 0; back < c.longestFixed; back++) {
    const { month, day } = monthDayOf(epochDay - back);
    for (const rule of c.fixedHolidays) {
      if (rule.days > back && rule.month === month && rule.day === day) return true;
    }
  }
  for (let back = 0; back < c.longestHijri; back++) {
    const hijri = hijriDateOfEpochDay(epochDay - back);
    for (const rule of c.hijriHolidays) {
      if (rule.days > back && rule.month === hijri.month && rule.day === hijri.day) return true;
    }
  }
  return false;
}

/**
 * The hours of a local date. Precedence: override, then holiday, then Ramadan
 * hours (only on days the week marks as working), then the week.
 */
function rangesOn(c: CompiledCalendar, epochDay: number): readonly MinuteRange[] {
  const override = c.overrides.get(epochDay);
  if (override !== undefined) return override;

  const weekly = c.week[weekdayOf(epochDay)] ?? CLOSED;
  if (weekly.length === 0 || isHoliday(c, epochDay)) return CLOSED;

  if (c.ramadanHours !== undefined && hijriDateOfEpochDay(epochDay).month === 9) {
    return c.ramadanHours;
  }
  return weekly;
}

/** Working intervals of a local date as instants: sorted, merged and half-open. */
export function intervalsOn(c: CompiledCalendar, epochDay: number): Interval[] {
  const intervals: Interval[] = [];
  for (const [startMinute, endMinute] of rangesOn(c, epochDay)) {
    const start = instantAt(c.timeZone, epochDay, startMinute);
    const end = instantAt(c.timeZone, epochDay, endMinute);
    // A DST gap can push the start of a range past its end. Drop what is left.
    if (start < end) intervals.push({ start, end });
  }
  if (intervals.length < 2) return intervals;

  intervals.sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (last !== undefined && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push(interval);
  }
  return merged;
}

/**
 * The working intervals of a local date ("YYYY-MM-DD") as instants.
 * They are sorted, do not overlap, and are half-open: [start, end).
 */
export function workingIntervals(cal: CalendarDefinition, localDate: string): Interval[] {
  return intervalsOn(compileCalendar(cal), toEpochDay(localDate));
}
