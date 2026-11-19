/** Day of the week. 0 is Sunday and 6 is Saturday, like `Date#getDay`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Working hours inside one local day, as "HH:MM" 24-hour wall times.
 * `start` must be before `end`. `end` may be "24:00" for the end of the day.
 */
export interface TimeRange {
  start: string;
  end: string;
}

/**
 * A holiday on an Umm al-Qura Hijri date. It lasts `days` consecutive civil
 * days, so it can run into the next Hijri month.
 */
export interface HijriHolidayRule {
  name: string;
  /** Hijri month, 1 to 12. Ramadan is 9. */
  month: number;
  /** Day of the Hijri month, 1 to 30. */
  day: number;
  /** Consecutive civil days, starting on the Hijri date. */
  days: number;
}

/** A holiday on the same Gregorian date every year. */
export interface FixedHolidayRule {
  name: string;
  /** Gregorian month, 1 to 12. */
  month: number;
  /** Day of the month. */
  day: number;
  /** Consecutive civil days. Defaults to 1. */
  days?: number;
}

/**
 * The hours of one local date. An empty list closes the day.
 * An override wins over holidays, Ramadan hours and the week.
 */
export interface DateOverride {
  /** Local date as "YYYY-MM-DD". */
  date: string;
  hours: TimeRange[];
  name?: string;
}

/** A business calendar. It is plain JSON data. */
export interface CalendarDefinition {
  id: string;
  name: string;
  /** IANA time zone, for example "Asia/Riyadh". */
  timeZone: string;
  /** Hours per weekday. A missing day or an empty list is a day off. */
  week: Partial<Record<Weekday, TimeRange[]>>;
  /** Replaces the week's hours on working days in Hijri month 9. */
  ramadanHours?: TimeRange[];
  hijriHolidays?: HijriHolidayRule[];
  fixedHolidays?: FixedHolidayRule[];
  /** Announced dates: one-off closures or extra working days. Later entries win. */
  overrides?: DateOverride[];
}

/** A half-open span of instants, [start, end), in epoch milliseconds. */
export interface Interval {
  start: number;
  end: number;
}

/** A date in the Umm al-Qura calendar. */
export interface HijriDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** A pause of the SLA clock. `to: null` means the clock is still paused. */
export interface Pause {
  from: number;
  to: number | null;
}

export interface SlaClockInput {
  /** When the clock started. */
  startedAt: number;
  /** Business time allowed, in milliseconds. Must be positive. */
  targetMs: number;
  /** The instant to read the clock at. */
  now: number;
  /** Pauses. They may overlap and need not be sorted. */
  pauses?: Pause[];
  /** When the clock stopped for good, for example at resolution. */
  stoppedAt?: number | null;
}

export interface SlaClock {
  /** Business time counted up to `now`, or up to `stoppedAt` if that is earlier. */
  elapsedMs: number;
  /** `targetMs - elapsedMs`. Negative once the target is breached. */
  remainingMs: number;
  /** A pause covers `now`. Never true once the clock has stopped. */
  paused: boolean;
  /** When the target will be reached if no further pause happens. Null while paused or stopped. */
  dueAt: number | null;
  /** When elapsed time first reached the target, or null. */
  breachedAt: number | null;
  /** `stoppedAt` is set and not after `now`. */
  stopped: boolean;
}
