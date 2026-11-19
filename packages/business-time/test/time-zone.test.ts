import { describe, expect, it } from "vitest";
import {
  addBusinessTime,
  businessTimeBetween,
  localDateOf,
  localToInstant,
  presetCalendar,
  workingIntervals,
} from "../src/index";
import { HOUR, MINUTE, addDays, at, datesBetween, offsetMinutes, wallTime } from "./helpers";

const CAIRO = "Africa/Cairo";

/** Cairo's UTC offset in minutes at noon UTC of a date. */
function cairoOffsetOn(date: string): number {
  return offsetMinutes(at(`${date}T12:00Z`), CAIRO);
}

/** The instant of a Cairo wall time, from an offset Intl reports. */
function cairoInstant(date: string, time: string): number {
  return at(`${date}T${time}Z`) - cairoOffsetOn(date) * MINUTE;
}

describe("Cairo across its 2026 DST changes", () => {
  const eg = presetCalendar("EG");
  // Scan 2026 for days whose offset differs from the day before. Nothing is hardcoded.
  const changes = datesBetween("2026-01-02", "2026-12-31").filter(
    (date) => cairoOffsetOn(date) !== cairoOffsetOn(addDays(date, -1)),
  );

  it("finds one change into summer time and one back", () => {
    expect(changes).toHaveLength(2);
  });

  it.each(changes)("keeps every working day at 8 hours from 09:00 around the change on %s", (change) => {
    const workingDays = datesBetween(addDays(change, -6), addDays(change, 6)).filter(
      (date) => workingIntervals(eg, date).length > 0,
    );

    for (const date of workingDays) {
      const intervals = workingIntervals(eg, date);
      expect(intervals).toHaveLength(1);
      const [interval] = intervals;
      expect(interval?.start).toBe(cairoInstant(date, "09:00"));
      expect(interval?.end).toBe(cairoInstant(date, "17:00"));
      expect((interval?.end ?? 0) - (interval?.start ?? 0)).toBe(8 * HOUR);
      expect(localToInstant(CAIRO, date, "09:00")).toBe(cairoInstant(date, "09:00"));
      expect(wallTime(cairoInstant(date, "09:00"), CAIRO)).toBe(`${date} 09:00`);
    }

    // The days checked must sit on both sides of the change.
    const before = workingDays.filter((date) => date < change);
    const after = workingDays.filter((date) => date >= change);
    expect(before.length).toBeGreaterThanOrEqual(3);
    expect(after.length).toBeGreaterThanOrEqual(3);
    const lastBefore = before.at(-1) ?? "";
    const firstAfter = after[0] ?? "";
    expect(cairoOffsetOn(lastBefore)).not.toBe(cairoOffsetOn(firstAfter));

    // Two business hours across the change: one before it and one after it.
    const lateBefore = cairoInstant(lastBefore, "16:00");
    const due = addBusinessTime(eg, lateBefore, 2 * HOUR);
    expect(due).toBe(cairoInstant(firstAfter, "10:00"));
    expect(businessTimeBetween(eg, lateBefore, due)).toBe(2 * HOUR);
  });

  it.each(changes)("maps 22:00 on the eve of the change on %s", (change) => {
    // Read as UTC, 22:00 on the eve is already past the change. A single offset
    // lookup would be an hour off here. The second lookup corrects it.
    const eve = addDays(change, -1);
    const instant = localToInstant(CAIRO, eve, "22:00");
    expect(instant).toBe(cairoInstant(eve, "22:00"));
    expect(wallTime(instant, CAIRO)).toBe(`${eve} 22:00`);
  });
});

describe("localDateOf and localToInstant", () => {
  it("reads the local date on the right side of midnight", () => {
    // 21:30 UTC is already the next day in Riyadh, at UTC+3.
    expect(localDateOf(at("2026-11-18T21:30Z"), "Asia/Riyadh")).toBe("2026-11-19");
    expect(localDateOf(at("2026-11-18T20:59:59.999Z"), "Asia/Riyadh")).toBe("2026-11-18");
    expect(localDateOf(at("2026-11-18T20:00Z"), "Asia/Dubai")).toBe("2026-11-19");
  });

  it("maps a wall time in fixed-offset GCC zones", () => {
    expect(localToInstant("Asia/Riyadh", "2026-11-15", "08:00")).toBe(at("2026-11-15T08:00+03:00"));
    expect(localToInstant("Asia/Dubai", "2026-11-16", "09:00")).toBe(at("2026-11-16T09:00+04:00"));
    expect(localToInstant("Asia/Muscat", "2026-11-16", "24:00")).toBe(at("2026-11-17T00:00+04:00"));
  });

  it("rejects bad input", () => {
    expect(() => localToInstant("Asia/Riyadh", "2026-11-15", "8:00")).toThrow(RangeError);
    expect(() => localToInstant("Asia/Riyadh", "2026-13-01", "08:00")).toThrow(RangeError);
    expect(() => localToInstant("Mars/Olympus", "2026-11-15", "08:00")).toThrow(RangeError);
  });
});
