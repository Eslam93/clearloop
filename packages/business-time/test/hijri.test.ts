import { describe, expect, it } from "vitest";
import { hijriDateOf, isRamadan, presetCalendar, workingIntervals } from "../src/index";
import { addDays, datesBetween, span, weekdayOf } from "./helpers";

const sa = presetCalendar("SA");

/** Founding Day and National Day. */
const SAUDI_FIXED_HOLIDAYS = new Set(["2026-02-22", "2026-09-23"]);

/** Saudi hours for a date with the given range. None on Friday, Saturday or a fixed holiday. */
function saudiHours(date: string, start: string, end: string): Array<{ start: number; end: number }> {
  const weekday = weekdayOf(date);
  if (weekday === 5 || weekday === 6 || SAUDI_FIXED_HOLIDAYS.has(date)) return [];
  return [span(date, start, end, "+03:00")];
}

describe("Ramadan 2026", () => {
  const februaryAndMarch = datesBetween("2026-02-01", "2026-03-31");
  const ramadan = februaryAndMarch.filter((date) => isRamadan(date));
  const first = ramadan[0] ?? "";
  const last = ramadan.at(-1) ?? "";

  it("is one contiguous run of 29 or 30 days", () => {
    expect([29, 30]).toContain(ramadan.length);
    expect(datesBetween(first, last)).toEqual(ramadan);
    expect(ramadan.map((date) => hijriDateOf(date).day)).toEqual(ramadan.map((_, index) => index + 1));
    expect(new Set(ramadan.map((date) => hijriDateOf(date).year))).toEqual(new Set([1447]));
  });

  it("uses the Saudi Ramadan hours on working days", () => {
    // Founding Day falls inside this Ramadan, and the holiday wins over Ramadan hours.
    expect(ramadan).toContain("2026-02-22");
    for (const date of ramadan) {
      expect(workingIntervals(sa, date)).toEqual(saudiHours(date, "10:00", "15:00"));
    }
  });

  it("uses normal hours the week before", () => {
    for (const date of datesBetween(addDays(first, -7), addDays(first, -1))) {
      expect(workingIntervals(sa, date)).toEqual(saudiHours(date, "08:00", "17:00"));
    }
  });

  it("closes the four days of Eid al-Fitr, then returns to normal hours", () => {
    const eid = addDays(last, 1);
    expect(hijriDateOf(eid)).toEqual({ year: 1447, month: 10, day: 1 });
    for (let day = 0; day < 4; day++) {
      expect(workingIntervals(sa, addDays(eid, day))).toEqual([]);
    }
    const afterEid = addDays(eid, 4);
    expect(workingIntervals(sa, afterEid)).toEqual(saudiHours(afterEid, "08:00", "17:00"));
  });
});

describe("hijriDateOf", () => {
  it("returns the same frozen object for the same date", () => {
    const date = hijriDateOf("2026-11-19");
    expect(hijriDateOf("2026-11-19")).toBe(date);
    expect(Object.isFrozen(date)).toBe(true);
  });

  it("moves forward one day at a time", () => {
    const days = datesBetween("2026-01-01", "2026-12-31").map(hijriDateOf);
    for (let index = 1; index < days.length; index++) {
      const previous = days[index - 1];
      const current = days[index];
      if (current?.day === 1) {
        expect([29, 30]).toContain(previous?.day);
      } else {
        expect(current?.day).toBe((previous?.day ?? 0) + 1);
        expect(current?.month).toBe(previous?.month);
      }
    }
  });

  it("rejects a malformed date", () => {
    expect(() => hijriDateOf("2026-02-29")).toThrow(RangeError);
    expect(() => isRamadan("tomorrow")).toThrow(RangeError);
  });
});
