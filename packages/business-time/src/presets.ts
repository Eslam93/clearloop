import type { CalendarDefinition, TimeRange, Weekday } from "./types";

// Ready-made calendars for the GCC and Egypt. Governments announce the real
// holiday dates each year, and they can differ from these rules by a day or
// more. Movable holidays are not included. Add both as overrides.

export type PresetId = "SA" | "AE" | "QA" | "KW" | "BH" | "OM" | "EG";

const SUNDAY_TO_THURSDAY: readonly Weekday[] = [0, 1, 2, 3, 4];
const MONDAY_TO_FRIDAY: readonly Weekday[] = [1, 2, 3, 4, 5];

function weekOf(days: readonly Weekday[], start: string, end: string): Partial<Record<Weekday, TimeRange[]>> {
  const week: Partial<Record<Weekday, TimeRange[]>> = {};
  for (const day of days) week[day] = [{ start, end }];
  return week;
}

const presets: Record<PresetId, CalendarDefinition> = {
  // Saudi Arabia.
  // Holiday lengths are defaults. Override them with the announced dates.
  SA: {
    id: "SA",
    name: "Saudi Arabia",
    timeZone: "Asia/Riyadh",
    week: weekOf(SUNDAY_TO_THURSDAY, "08:00", "17:00"),
    ramadanHours: [{ start: "10:00", end: "15:00" }],
    fixedHolidays: [
      { name: "Founding Day", month: 2, day: 22 },
      { name: "National Day", month: 9, day: 23 },
    ],
    hijriHolidays: [
      { name: "Eid al-Fitr", month: 10, day: 1, days: 4 },
      { name: "Eid al-Adha", month: 12, day: 10, days: 4 },
    ],
  },

  // United Arab Emirates. The UAE moved to a Saturday-Sunday weekend in 2022.
  // Holiday lengths are defaults. Override them with the announced dates.
  AE: {
    id: "AE",
    name: "United Arab Emirates",
    timeZone: "Asia/Dubai",
    week: weekOf(MONDAY_TO_FRIDAY, "09:00", "18:00"),
    ramadanHours: [{ start: "09:00", end: "16:00" }],
    fixedHolidays: [
      { name: "New Year's Day", month: 1, day: 1 },
      { name: "National Day", month: 12, day: 2, days: 2 },
    ],
    hijriHolidays: [
      { name: "Islamic New Year", month: 1, day: 1, days: 1 },
      { name: "Prophet's Birthday", month: 3, day: 12, days: 1 },
      { name: "Arafat Day", month: 12, day: 9, days: 1 },
      { name: "Eid al-Fitr", month: 10, day: 1, days: 3 },
      { name: "Eid al-Adha", month: 12, day: 10, days: 3 },
    ],
  },

  // Qatar.
  // Holiday lengths are defaults. Override them with the announced dates.
  QA: {
    id: "QA",
    name: "Qatar",
    timeZone: "Asia/Qatar",
    week: weekOf(SUNDAY_TO_THURSDAY, "08:00", "17:00"),
    ramadanHours: [{ start: "09:00", end: "14:00" }],
    fixedHolidays: [{ name: "National Day", month: 12, day: 18 }],
    hijriHolidays: [
      { name: "Eid al-Fitr", month: 10, day: 1, days: 3 },
      { name: "Eid al-Adha", month: 12, day: 10, days: 3 },
    ],
  },

  // Kuwait.
  // Holiday lengths are defaults. Override them with the announced dates.
  KW: {
    id: "KW",
    name: "Kuwait",
    timeZone: "Asia/Kuwait",
    week: weekOf(SUNDAY_TO_THURSDAY, "08:00", "17:00"),
    ramadanHours: [{ start: "09:00", end: "14:00" }],
    fixedHolidays: [
      { name: "New Year's Day", month: 1, day: 1 },
      { name: "National Day", month: 2, day: 25 },
      { name: "Liberation Day", month: 2, day: 26 },
    ],
    hijriHolidays: [
      { name: "Eid al-Fitr", month: 10, day: 1, days: 3 },
      { name: "Eid al-Adha", month: 12, day: 10, days: 3 },
    ],
  },

  // Bahrain.
  // Holiday lengths are defaults. Override them with the announced dates.
  BH: {
    id: "BH",
    name: "Bahrain",
    timeZone: "Asia/Bahrain",
    week: weekOf(SUNDAY_TO_THURSDAY, "08:00", "17:00"),
    ramadanHours: [{ start: "09:00", end: "14:00" }],
    fixedHolidays: [
      { name: "New Year's Day", month: 1, day: 1 },
      { name: "Labour Day", month: 5, day: 1 },
      { name: "National Day", month: 12, day: 16, days: 2 },
    ],
    hijriHolidays: [
      { name: "Eid al-Fitr", month: 10, day: 1, days: 3 },
      { name: "Eid al-Adha", month: 12, day: 10, days: 3 },
    ],
  },

  // Oman. The National Day is left out on purpose. Its date changed recently,
  // so it belongs in overrides once it is announced.
  // Holiday lengths are defaults. Override them with the announced dates.
  OM: {
    id: "OM",
    name: "Oman",
    timeZone: "Asia/Muscat",
    week: weekOf(SUNDAY_TO_THURSDAY, "08:00", "17:00"),
    ramadanHours: [{ start: "09:00", end: "14:00" }],
    hijriHolidays: [
      { name: "Eid al-Fitr", month: 10, day: 1, days: 3 },
      { name: "Eid al-Adha", month: 12, day: 10, days: 3 },
    ],
  },

  // Egypt. Cairo observes DST again since 2023.
  // Holiday lengths are defaults. Override them with the announced dates.
  EG: {
    id: "EG",
    name: "Egypt",
    timeZone: "Africa/Cairo",
    week: weekOf(SUNDAY_TO_THURSDAY, "09:00", "17:00"),
    ramadanHours: [{ start: "09:00", end: "15:00" }],
    fixedHolidays: [
      { name: "Coptic Christmas", month: 1, day: 7 },
      { name: "Revolution and Police Day", month: 1, day: 25 },
      { name: "Sinai Liberation Day", month: 4, day: 25 },
      { name: "Labour Day", month: 5, day: 1 },
      { name: "June 30 Revolution", month: 6, day: 30 },
      { name: "Revolution Day", month: 7, day: 23 },
      { name: "Armed Forces Day", month: 10, day: 6 },
    ],
    hijriHolidays: [
      { name: "Islamic New Year", month: 1, day: 1, days: 1 },
      { name: "Prophet's Birthday", month: 3, day: 12, days: 1 },
      { name: "Eid al-Fitr", month: 10, day: 1, days: 3 },
      { name: "Eid al-Adha", month: 12, day: 10, days: 4 },
    ],
  },
};

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * The preset calendars, frozen so one tenant's edits can never leak into
 * another's. Use `presetCalendar` for a copy you can change.
 */
export const PRESETS: Readonly<Record<PresetId, CalendarDefinition>> = deepFreeze(presets);

/** A fresh copy of a preset that is safe to change, for example to add overrides. */
export function presetCalendar(id: string): CalendarDefinition {
  if (!Object.hasOwn(PRESETS, id)) {
    throw new Error(`Unknown calendar preset "${id}". Presets: ${Object.keys(PRESETS).join(", ")}.`);
  }
  return JSON.parse(JSON.stringify(PRESETS[id as PresetId])) as CalendarDefinition;
}
