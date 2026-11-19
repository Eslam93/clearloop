import { describe, expect, it } from "vitest";
import {
  addBusinessTime,
  businessTimeBetween,
  hijriDateOf,
  isRamadan,
  isWorkingTime,
  nextWorkingInstant,
  presetCalendar,
  workingIntervals,
  type CalendarDefinition,
  type TimeRange,
} from "../src/index";
import { DAY, HOUR, MINUTE, addDays, at, datesBetween, span } from "./helpers";

const sa = presetCalendar("SA");
const ae = presetCalendar("AE");

const nineToFive: TimeRange[] = [{ start: "09:00", end: "17:00" }];
/** Open 09:00 to 17:00 every day of the week, in Riyadh. */
const everyDay: CalendarDefinition = {
  id: "every-day",
  name: "Every day",
  timeZone: "Asia/Riyadh",
  week: { 0: nineToFive, 1: nineToFive, 2: nineToFive, 3: nineToFive, 4: nineToFive, 5: nineToFive, 6: nineToFive },
};

describe("addBusinessTime", () => {
  it("carries a Saudi Thursday afternoon over the weekend to Sunday", () => {
    // 2026-11-12 is a Thursday. 30 minutes are left that day, then Friday and Saturday are off.
    expect(addBusinessTime(sa, at("2026-11-12T16:30+03:00"), HOUR)).toBe(at("2026-11-15T08:30+03:00"));
  });

  it("carries a UAE Friday evening over the Saturday-Sunday weekend to Monday", () => {
    expect(addBusinessTime(ae, at("2026-11-13T17:30+04:00"), HOUR)).toBe(at("2026-11-16T09:30+04:00"));
  });

  it("returns the end of an interval when the time runs out exactly there", () => {
    expect(addBusinessTime(sa, at("2026-11-12T16:00+03:00"), HOUR)).toBe(at("2026-11-12T17:00+03:00"));
  });

  it("starts at the next opening when it starts outside working hours", () => {
    expect(addBusinessTime(sa, at("2026-11-13T12:00+03:00"), 90 * MINUTE)).toBe(at("2026-11-15T09:30+03:00"));
  });

  it("returns the start unchanged for zero, even outside working hours", () => {
    const fridayNoon = at("2026-11-13T12:00+03:00");
    expect(addBusinessTime(sa, fridayNoon, 0)).toBe(fridayNoon);
  });

  it("rejects a negative or non-finite duration", () => {
    const start = at("2026-11-12T10:00+03:00");
    expect(() => addBusinessTime(sa, start, -1)).toThrow(RangeError);
    expect(() => addBusinessTime(sa, start, Number.NaN)).toThrow(RangeError);
    expect(() => addBusinessTime(sa, start, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("businessTimeBetween", () => {
  it("counts only working time, and is negative when reversed", () => {
    const thursday = at("2026-11-12T16:00+03:00");
    const sunday = at("2026-11-15T09:00+03:00");
    expect(businessTimeBetween(sa, thursday, sunday)).toBe(2 * HOUR);
    expect(businessTimeBetween(sa, sunday, thursday)).toBe(-2 * HOUR);
    expect(businessTimeBetween(sa, thursday, thursday)).toBe(0);
  });

  it("returns 0, not -0, for a reversed span with no working time", () => {
    expect(Object.is(businessTimeBetween(sa, at("2026-11-14T12:00+03:00"), at("2026-11-13T12:00+03:00")), 0)).toBe(
      true,
    );
  });
});

describe("isWorkingTime and nextWorkingInstant", () => {
  it("treats intervals as half-open", () => {
    expect(isWorkingTime(sa, at("2026-11-12T08:00+03:00"))).toBe(true);
    expect(isWorkingTime(sa, at("2026-11-12T16:59:59.999+03:00"))).toBe(true);
    expect(isWorkingTime(sa, at("2026-11-12T17:00+03:00"))).toBe(false);
    expect(isWorkingTime(sa, at("2026-11-12T07:59:59.999+03:00"))).toBe(false);
  });

  it("finds Sunday 08:00 from a Saudi Friday, and returns a working instant itself", () => {
    expect(nextWorkingInstant(sa, at("2026-11-13T12:00+03:00"))).toBe(at("2026-11-15T08:00+03:00"));
    expect(nextWorkingInstant(sa, at("2026-11-12T17:00+03:00"))).toBe(at("2026-11-15T08:00+03:00"));
    const thursdayMorning = at("2026-11-12T10:15+03:00");
    expect(nextWorkingInstant(sa, thursdayMorning)).toBe(thursdayMorning);
  });
});

describe("holidays", () => {
  it("skips Saudi National Day when it falls on a weekday", () => {
    // 2026-09-23 is a Wednesday.
    expect(workingIntervals(sa, "2026-09-22")).toEqual([span("2026-09-22", "08:00", "17:00", "+03:00")]);
    expect(workingIntervals(sa, "2026-09-23")).toEqual([]);
    expect(isWorkingTime(sa, at("2026-09-23T10:00+03:00"))).toBe(false);
    // One hour on Tuesday, Wednesday is skipped, then one hour on Thursday.
    expect(addBusinessTime(sa, at("2026-09-22T16:00+03:00"), 2 * HOUR)).toBe(at("2026-09-24T09:00+03:00"));
    expect(businessTimeBetween(sa, at("2026-09-22T17:00+03:00"), at("2026-09-24T08:00+03:00"))).toBe(0);
  });

  it("lets a holiday win over Ramadan hours", () => {
    // Founding Day, 2026-02-22, is a Sunday inside Ramadan.
    expect(isRamadan("2026-02-22")).toBe(true);
    expect(workingIntervals(sa, "2026-02-22")).toEqual([]);
  });

  it("covers consecutive civil days from a Hijri date, into the next Hijri month", () => {
    const yearEnd: CalendarDefinition = {
      ...everyDay,
      hijriHolidays: [{ name: "Year end", month: 12, day: 29, days: 3 }],
    };
    const start = datesBetween("2026-01-01", "2026-12-31").find((date) => {
      const hijri = hijriDateOf(date);
      return hijri.month === 12 && hijri.day === 29;
    });
    if (start === undefined) throw new Error("No Hijri 12/29 found in 2026.");

    // The rule runs past the end of the Hijri year.
    expect(hijriDateOf(addDays(start, 2)).month).toBe(1);
    expect(workingIntervals(yearEnd, addDays(start, -1))).toHaveLength(1);
    expect(workingIntervals(yearEnd, start)).toEqual([]);
    expect(workingIntervals(yearEnd, addDays(start, 1))).toEqual([]);
    expect(workingIntervals(yearEnd, addDays(start, 2))).toEqual([]);
    expect(workingIntervals(yearEnd, addDays(start, 3))).toHaveLength(1);
  });

  it("lets a fixed holiday run into the next month", () => {
    const newYear: CalendarDefinition = {
      ...everyDay,
      fixedHolidays: [{ name: "Year end", month: 12, day: 31, days: 2 }],
    };
    expect(workingIntervals(newYear, "2026-12-30")).toHaveLength(1);
    expect(workingIntervals(newYear, "2026-12-31")).toEqual([]);
    expect(workingIntervals(newYear, "2027-01-01")).toEqual([]);
    expect(workingIntervals(newYear, "2027-01-02")).toHaveLength(1);
  });
});

describe("overrides", () => {
  it("closes a normal working day with empty hours", () => {
    const cal: CalendarDefinition = { ...sa, overrides: [{ date: "2026-11-15", hours: [], name: "Office move" }] };
    expect(workingIntervals(cal, "2026-11-15")).toEqual([]);
    // Thursday 16:30 plus one hour now lands on Monday.
    expect(addBusinessTime(cal, at("2026-11-12T16:30+03:00"), HOUR)).toBe(at("2026-11-16T08:30+03:00"));
  });

  it("opens a Saturday", () => {
    const cal: CalendarDefinition = {
      ...sa,
      overrides: [{ date: "2026-11-14", hours: [{ start: "10:00", end: "14:00" }] }],
    };
    expect(workingIntervals(cal, "2026-11-14")).toEqual([span("2026-11-14", "10:00", "14:00", "+03:00")]);
    expect(addBusinessTime(cal, at("2026-11-12T16:30+03:00"), HOUR)).toBe(at("2026-11-14T10:30+03:00"));
  });

  it("wins over a holiday, and a later override for the same date wins", () => {
    const cal: CalendarDefinition = {
      ...sa,
      overrides: [
        { date: "2026-09-23", hours: [] },
        { date: "2026-09-23", hours: [{ start: "08:00", end: "12:00" }], name: "Half day" },
      ],
    };
    expect(workingIntervals(cal, "2026-09-23")).toEqual([span("2026-09-23", "08:00", "12:00", "+03:00")]);
  });
});

describe("working hours", () => {
  it("merges overlapping and touching ranges, whatever their order", () => {
    const split: CalendarDefinition = {
      ...everyDay,
      week: {
        0: [
          { start: "13:00", end: "17:00" },
          { start: "08:00", end: "12:00" },
          { start: "12:00", end: "13:30" },
        ],
      },
    };
    expect(workingIntervals(split, "2026-11-15")).toEqual([span("2026-11-15", "08:00", "17:00", "+03:00")]);
  });

  it("keeps a lunch break as two intervals", () => {
    const lunch: CalendarDefinition = {
      ...everyDay,
      week: {
        0: [
          { start: "08:00", end: "12:00" },
          { start: "13:00", end: "17:00" },
        ],
      },
    };
    expect(workingIntervals(lunch, "2026-11-15")).toEqual([
      span("2026-11-15", "08:00", "12:00", "+03:00"),
      span("2026-11-15", "13:00", "17:00", "+03:00"),
    ]);
    expect(addBusinessTime(lunch, at("2026-11-15T11:30+03:00"), HOUR)).toBe(at("2026-11-15T13:30+03:00"));
  });

  it("supports a round-the-clock calendar that ends each day at 24:00", () => {
    const allDay: TimeRange[] = [{ start: "00:00", end: "24:00" }];
    const always: CalendarDefinition = {
      id: "always",
      name: "Always open",
      timeZone: "Asia/Dubai",
      week: { 0: allDay, 1: allDay, 2: allDay, 3: allDay, 4: allDay, 5: allDay, 6: allDay },
    };
    const lateThursday = at("2026-11-12T23:30+04:00");
    expect(addBusinessTime(always, lateThursday, HOUR)).toBe(lateThursday + HOUR);
    expect(businessTimeBetween(always, lateThursday, lateThursday + 3 * DAY)).toBe(3 * DAY);
    expect(isWorkingTime(always, at("2026-11-13T00:00+04:00"))).toBe(true);
  });
});

describe("guards", () => {
  const closed: CalendarDefinition = { id: "closed", name: "Closed", timeZone: "Asia/Riyadh", week: {} };
  const start = at("2026-11-12T10:00+03:00");

  it("throws a clear error when a calendar has no working time", () => {
    expect(() => nextWorkingInstant(closed, start)).toThrow('Calendar "closed" has no working time in the 3 years');
    expect(() => addBusinessTime(closed, start, HOUR)).toThrow('Calendar "closed" has no working time');
  });

  it("still measures a span with no working time as zero", () => {
    expect(businessTimeBetween(closed, start, start + 30 * DAY)).toBe(0);
  });

  it("rejects instants that are not finite numbers", () => {
    expect(() => isWorkingTime(sa, Number.NaN)).toThrow(RangeError);
    expect(() => businessTimeBetween(sa, start, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("rejects a malformed local date", () => {
    expect(() => workingIntervals(sa, "2026-02-30")).toThrow(RangeError);
    expect(() => workingIntervals(sa, "15/11/2026")).toThrow(RangeError);
  });
});
