import { compileCalendar, intervalsOn, type CompiledCalendar } from "./calendar";
import { assertInstant, formatEpochDay } from "./dates";
import { localEpochDayAt } from "./time-zone";
import type { CalendarDefinition } from "./types";

/** A search for working time gives up after this many years without any. */
const MAX_IDLE_YEARS = 3;
const MAX_IDLE_DAYS = MAX_IDLE_YEARS * 366;
/** No walk covers more than this many years. */
const MAX_SPAN_YEARS = 100;
const MAX_SPAN_DAYS = MAX_SPAN_YEARS * 366;

function noWorkingTime(c: CompiledCalendar, fromDay: number): Error {
  return new Error(
    `Calendar "${c.id}" has no working time in the ${MAX_IDLE_YEARS} years after ${formatEpochDay(fromDay)}.`,
  );
}

function spanTooLong(fromDay: number): RangeError {
  return new RangeError(
    `Business time is only walked up to ${MAX_SPAN_YEARS} years from ${formatEpochDay(fromDay)}.`,
  );
}

// The functions below take a compiled calendar, so the SLA clock can reuse one.

export function isWorkingAt(c: CompiledCalendar, at: number): boolean {
  const day = localEpochDayAt(c.timeZone, at);
  return intervalsOn(c, day).some((interval) => interval.start <= at && at < interval.end);
}

export function nextWorkingAt(c: CompiledCalendar, from: number): number {
  const firstDay = localEpochDayAt(c.timeZone, from);
  for (let day = firstDay; day <= firstDay + MAX_IDLE_DAYS; day++) {
    for (const interval of intervalsOn(c, day)) {
      if (interval.end > from) return Math.max(interval.start, from);
    }
  }
  throw noWorkingTime(c, firstDay);
}

export function addIn(c: CompiledCalendar, from: number, ms: number): number {
  if (ms === 0) return from;
  let remaining = ms;
  const firstDay = localEpochDayAt(c.timeZone, from);
  let lastWorkingDay = firstDay;
  for (let day = firstDay; day <= firstDay + MAX_SPAN_DAYS; day++) {
    for (const interval of intervalsOn(c, day)) {
      if (interval.end <= from) continue;
      lastWorkingDay = day;
      const start = Math.max(interval.start, from);
      const available = interval.end - start;
      // Running out exactly at the end of an interval returns that end.
      if (remaining <= available) return start + remaining;
      remaining -= available;
    }
    if (day - lastWorkingDay >= MAX_IDLE_DAYS) throw noWorkingTime(c, lastWorkingDay);
  }
  throw spanTooLong(firstDay);
}

export function betweenIn(c: CompiledCalendar, from: number, to: number): number {
  if (from === to) return 0;
  if (to < from) {
    const forward = betweenIn(c, to, from);
    return forward === 0 ? 0 : -forward;
  }
  const firstDay = localEpochDayAt(c.timeZone, from);
  const lastDay = localEpochDayAt(c.timeZone, to);
  if (lastDay - firstDay > MAX_SPAN_DAYS) throw spanTooLong(firstDay);

  let total = 0;
  for (let day = firstDay; day <= lastDay; day++) {
    for (const interval of intervalsOn(c, day)) {
      const start = Math.max(interval.start, from);
      const end = Math.min(interval.end, to);
      if (start < end) total += end - start;
    }
  }
  return total;
}

/** True when the instant falls inside a working interval. */
export function isWorkingTime(cal: CalendarDefinition, at: number): boolean {
  assertInstant(at, "at");
  return isWorkingAt(compileCalendar(cal), at);
}

/** The first working instant at or after `from`. */
export function nextWorkingInstant(cal: CalendarDefinition, from: number): number {
  assertInstant(from, "from");
  return nextWorkingAt(compileCalendar(cal), from);
}

/**
 * The instant at which `ms` of working time has elapsed after `from`.
 * Zero returns `from` unchanged, even outside working hours. When the time runs
 * out exactly at the end of an interval, the result is that end. So adding `a`
 * and then `b` gives the same instant as adding `a + b`.
 */
export function addBusinessTime(cal: CalendarDefinition, from: number, ms: number): number {
  assertInstant(from, "from");
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) {
    throw new RangeError(`ms must be a finite number of milliseconds, zero or more, got ${String(ms)}.`);
  }
  return addIn(compileCalendar(cal), from, ms);
}

/** Working milliseconds in [from, to). Negative when `to` is before `from`. */
export function businessTimeBetween(cal: CalendarDefinition, from: number, to: number): number {
  assertInstant(from, "from");
  assertInstant(to, "to");
  return betweenIn(compileCalendar(cal), from, to);
}
