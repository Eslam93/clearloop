import { describe, expect, it } from "vitest";
import { PRESETS, parseCalendar } from "../src/index";

const valid = {
  id: "acme",
  name: "Acme Trading",
  timeZone: "Asia/Riyadh",
  week: { 0: [{ start: "08:00", end: "17:00" }] },
};

/** `valid` with Sunday's hours replaced. */
function withSunday(start: unknown, end: unknown): unknown {
  return { ...valid, week: { 0: [{ start, end }] } };
}

describe("parseCalendar", () => {
  it("accepts every preset and returns an equal copy", () => {
    for (const preset of Object.values(PRESETS)) {
      const parsed = parseCalendar(JSON.parse(JSON.stringify(preset)));
      expect(parsed).toEqual(preset);
      expect(parsed).not.toBe(preset);
    }
  });

  it("accepts null for optional fields and drops them", () => {
    expect(parseCalendar({ ...valid, ramadanHours: null, overrides: null, week: { 0: null } })).toEqual({
      ...valid,
      week: {},
    });
  });

  it("rejects a bad time zone", () => {
    expect(() => parseCalendar({ ...valid, timeZone: "Mars/Olympus" })).toThrow(/^Invalid calendar at timeZone:/);
    expect(() => parseCalendar({ ...valid, timeZone: "+03:00" })).toThrow(/at timeZone:/);
    expect(() => parseCalendar({ ...valid, timeZone: 3 })).toThrow(/at timeZone:/);
  });

  it("rejects a bad time", () => {
    for (const bad of ["8:00", "25:00", "17:60", "08:00:00", "noon", 800]) {
      expect(() => parseCalendar(withSunday(bad, "17:00"))).toThrow(/at week\.0\[0\]\.start: expected an "HH:MM"/);
    }
    expect(() => parseCalendar(withSunday("08:00", "24:01"))).toThrow(/at week\.0\[0\]\.end:/);
  });

  it("rejects a range whose start is not before its end", () => {
    expect(() => parseCalendar(withSunday("17:00", "08:00"))).toThrow(
      "Invalid calendar at week.0[0]: start must be before end, got 17:00 to 08:00.",
    );
    expect(() => parseCalendar(withSunday("09:00", "09:00"))).toThrow(/at week\.0\[0\]: start must be before end/);
    expect(() => parseCalendar({ ...valid, ramadanHours: [{ start: "15:00", end: "10:00" }] })).toThrow(
      /at ramadanHours\[0\]:/,
    );
  });

  it("accepts 24:00 as the end of the day", () => {
    expect(parseCalendar(withSunday("00:00", "24:00")).week[0]).toEqual([{ start: "00:00", end: "24:00" }]);
  });

  it("rejects weekday keys outside 0 to 6", () => {
    expect(() => parseCalendar({ ...valid, week: { 7: [] } })).toThrow(/at week\.7: unknown weekday/);
    expect(() => parseCalendar({ ...valid, week: { mon: [] } })).toThrow(/at week\.mon: unknown weekday/);
  });

  it("rejects malformed and impossible dates", () => {
    for (const date of ["2026-2-1", "2026-02-30", "2026-13-01", "20260201", ""]) {
      expect(() => parseCalendar({ ...valid, overrides: [{ date, hours: [] }] })).toThrow(
        /at overrides\[0\]\.date: expected a "YYYY-MM-DD" date/,
      );
    }
  });

  it("rejects holiday rules out of range", () => {
    const hijri = (rule: object) => ({ ...valid, hijriHolidays: [{ name: "Eid", month: 10, day: 1, days: 3, ...rule }] });
    expect(() => parseCalendar(hijri({ month: 13 }))).toThrow(/at hijriHolidays\[0\]\.month:/);
    expect(() => parseCalendar(hijri({ day: 31 }))).toThrow(/at hijriHolidays\[0\]\.day:/);
    expect(() => parseCalendar(hijri({ days: 0 }))).toThrow(/at hijriHolidays\[0\]\.days:/);
    expect(() => parseCalendar(hijri({ days: 1.5 }))).toThrow(/at hijriHolidays\[0\]\.days:/);
    expect(() => parseCalendar({ ...valid, fixedHolidays: [{ name: "Leap", month: 2, day: 30 }] })).toThrow(
      /at fixedHolidays\[0\]\.day: expected a whole number from 1 to 29/,
    );
  });

  it("rejects unknown fields, so a typo cannot drop holidays", () => {
    expect(() => parseCalendar({ ...valid, fixedHoliday: [] })).toThrow(/^Invalid calendar at fixedHoliday: unknown field/);
    expect(() => parseCalendar(withSunday("08:00", "17:00"))).not.toThrow();
    expect(() => parseCalendar({ ...valid, week: { 0: [{ start: "08:00", end: "17:00", lunch: true }] } })).toThrow(
      /at week\.0\[0\]\.lunch: unknown field/,
    );
  });

  it("rejects missing required fields and non-objects", () => {
    expect(() => parseCalendar(null)).toThrow("Invalid calendar: expected an object, got null.");
    expect(() => parseCalendar([])).toThrow(/expected an object/);
    const { week: _week, ...noWeek } = valid;
    expect(() => parseCalendar(noWeek)).toThrow(/at week: expected an object/);
    expect(() => parseCalendar({ ...valid, id: "" })).toThrow(/at id: expected a non-empty string/);
  });
});
