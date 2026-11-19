import { CACHE_LIMIT, DAY_MS, HOUR_MS, toEpochDay } from "./dates";
import type { HijriDate } from "./types";

let formatter: Intl.DateTimeFormat | undefined;
/** Per epoch day, so each civil date is formatted once. */
const cache = new Map<number, HijriDate>();

function hijriFormatter(): Intl.DateTimeFormat {
  if (formatter === undefined) {
    const candidate = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
      timeZone: "UTC",
      numberingSystem: "latn",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    // A runtime without full ICU data falls back to the Gregorian calendar
    // without an error. Stop here instead of returning wrong dates.
    if (candidate.resolvedOptions().calendar !== "islamic-umalqura") {
      throw new Error("This JavaScript runtime does not support the islamic-umalqura calendar in Intl.");
    }
    formatter = candidate;
  }
  return formatter;
}

/** Umm al-Qura date of an epoch day. */
export function hijriDateOfEpochDay(epochDay: number): HijriDate {
  const cached = cache.get(epochDay);
  if (cached !== undefined) return cached;

  // Noon UTC is safely inside the civil date.
  const parts = hijriFormatter().formatToParts(epochDay * DAY_MS + 12 * HOUR_MS);
  let year = Number.NaN;
  let month = Number.NaN;
  let day = Number.NaN;
  for (const part of parts) {
    if (part.type === "year") year = Number(part.value);
    else if (part.type === "month") month = Number(part.value);
    else if (part.type === "day") day = Number(part.value);
  }
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`Could not read a Hijri date from Intl output ${JSON.stringify(parts)}.`);
  }

  const hijri: HijriDate = Object.freeze({ year, month, day });
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(epochDay, hijri);
  return hijri;
}

/** Umm al-Qura date of a "YYYY-MM-DD" civil date. */
export function hijriDateOf(localDate: string): HijriDate {
  return hijriDateOfEpochDay(toEpochDay(localDate));
}

/** True when the civil date falls in Ramadan, Hijri month 9, by Umm al-Qura. */
export function isRamadan(localDate: string): boolean {
  return hijriDateOf(localDate).month === 9;
}
