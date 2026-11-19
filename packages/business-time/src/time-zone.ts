import {
  CACHE_LIMIT,
  DAY_MS,
  MINUTE_MS,
  assertInstant,
  epochDayFromParts,
  formatEpochDay,
  toEpochDay,
  toMinutes,
} from "./dates";

const formatters = new Map<string, Intl.DateTimeFormat>();
/** Per zone: wall time read as UTC, mapped to the real instant. */
const instantCaches = new Map<string, Map<number, number>>();

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function wallClockAt(timeZone: string, at: number): WallClock {
  const wall: WallClock = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
  for (const part of formatterFor(timeZone).formatToParts(at)) {
    switch (part.type) {
      case "year":
      case "month":
      case "day":
      case "hour":
      case "minute":
      case "second":
        wall[part.type] = Number(part.value);
    }
  }
  return wall;
}

/** The zone's offset from UTC at an instant, in milliseconds. Positive east of Greenwich. */
function offsetAt(timeZone: string, at: number): number {
  const wall = wallClockAt(timeZone, at);
  const wallMs =
    epochDayFromParts(wall.year, wall.month, wall.day) * DAY_MS +
    ((wall.hour * 60 + wall.minute) * 60 + wall.second) * 1000;
  // The formatter drops milliseconds, so compare with the instant cut to the second.
  return wallMs - Math.floor(at / 1000) * 1000;
}

/** Epoch day of the local date at an instant. */
export function localEpochDayAt(timeZone: string, at: number): number {
  const wall = wallClockAt(timeZone, at);
  return epochDayFromParts(wall.year, wall.month, wall.day);
}

/**
 * The instant of a local wall time, given as an epoch day and minutes after midnight.
 * A time skipped by a DST change moves forward by the length of the gap.
 * A time that happens twice resolves to one of the two.
 */
export function instantAt(timeZone: string, epochDay: number, minutes: number): number {
  let cache = instantCaches.get(timeZone);
  if (cache === undefined) {
    cache = new Map();
    instantCaches.set(timeZone, cache);
  }
  const wall = epochDay * DAY_MS + minutes * MINUTE_MS;
  let instant = cache.get(wall);
  if (instant === undefined) {
    // Guess with the offset at the wall time read as UTC. Then correct once
    // with the offset at the guess. That is enough for DST changes.
    const guess = wall - offsetAt(timeZone, wall);
    instant = wall - offsetAt(timeZone, guess);
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(wall, instant);
  }
  return instant;
}

/** The local date, as "YYYY-MM-DD", at an instant in a time zone. */
export function localDateOf(at: number, timeZone: string): string {
  assertInstant(at, "at");
  return formatEpochDay(localEpochDayAt(timeZone, at));
}

/** The instant of a local date and "HH:MM" wall time in a time zone. */
export function localToInstant(timeZone: string, date: string, time: string): number {
  return instantAt(timeZone, toEpochDay(date), toMinutes(time));
}
