import { describe, expect, it } from "vitest";
import { PRESETS, presetCalendar, workingIntervals, type PresetId } from "../src/index";
import { span } from "./helpers";

describe("PRESETS", () => {
  it("covers the GCC and Egypt, each keyed by its own id", () => {
    expect(Object.keys(PRESETS).sort()).toEqual(["AE", "BH", "EG", "KW", "OM", "QA", "SA"]);
    for (const [key, preset] of Object.entries(PRESETS)) expect(preset.id).toBe(key);
  });

  it("works Sunday to Thursday, except the UAE which works Monday to Friday", () => {
    for (const [id, preset] of Object.entries(PRESETS)) {
      const expected = id === "AE" ? ["1", "2", "3", "4", "5"] : ["0", "1", "2", "3", "4"];
      expect(Object.keys(preset.week).sort()).toEqual(expected);
    }
  });

  it("is frozen, so no tenant can change a shared preset", () => {
    expect(() => {
      PRESETS.SA.overrides = [];
    }).toThrow(TypeError);
    expect(() => {
      PRESETS.SA.fixedHolidays?.push({ name: "Extra", month: 1, day: 1 });
    }).toThrow(TypeError);
  });
});

describe("presetCalendar", () => {
  it("returns a copy that is safe to change", () => {
    const copy = presetCalendar("SA");
    expect(copy).toEqual(PRESETS.SA);
    copy.overrides = [{ date: "2026-11-15", hours: [] }];
    copy.week[0]?.push({ start: "18:00", end: "20:00" });
    expect(PRESETS.SA.overrides).toBeUndefined();
    expect(PRESETS.SA.week[0]).toEqual([{ start: "08:00", end: "17:00" }]);
    expect(workingIntervals(copy, "2026-11-15")).toEqual([]);
    expect(workingIntervals(PRESETS.SA, "2026-11-15")).toEqual([span("2026-11-15", "08:00", "17:00", "+03:00")]);
  });

  it("names the known presets when the id is unknown", () => {
    expect(() => presetCalendar("XX")).toThrow('Unknown calendar preset "XX". Presets: SA, AE, QA, KW, BH, OM, EG.');
    expect(() => presetCalendar("toString")).toThrow(/Unknown calendar preset/);
  });

  it("accepts every preset id", () => {
    const ids: PresetId[] = ["SA", "AE", "QA", "KW", "BH", "OM", "EG"];
    for (const id of ids) expect(presetCalendar(id).id).toBe(id);
  });
});
