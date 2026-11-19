import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  PRESETS,
  addBusinessTime,
  businessTimeBetween,
  isWorkingTime,
  localDateOf,
  nextWorkingInstant,
  slaClock,
  workingIntervals,
  type Pause,
  type PresetId,
  type SlaClockInput,
} from "../src/index";
import { DAY, HOUR, MINUTE } from "./helpers";

const RUNS = 200;
const QUARTER_HOUR = 15 * MINUTE;
const FIRST = Date.UTC(2024, 0, 1);
const LAST = Date.UTC(2031, 0, 1);

// Every preset zone has a whole-hour offset, so quarter hours in UTC are
// quarter hours locally too. That is where working intervals start and end.

/** An instant from 2024 to the end of 2030. Half of them fall on a quarter hour. */
const instant = fc.oneof(
  fc.integer({ min: FIRST, max: LAST }),
  fc.integer({ min: FIRST / QUARTER_HOUR, max: LAST / QUARTER_HOUR }).map((n) => n * QUARTER_HOUR),
);

/** 0 to 300 business hours. Half of them are whole quarter hours, so sums land on interval ends. */
const duration = fc.oneof(
  fc.integer({ min: 0, max: 300 * HOUR }),
  fc.integer({ min: 0, max: 300 * 4 }).map((n) => n * QUARTER_HOUR),
);
const positiveDuration = duration.filter((ms) => ms > 0);

/** A gap between two instants: often short, sometimes months. */
const gap = fc.oneof(fc.integer({ min: 0, max: 2 * DAY }), fc.integer({ min: 0, max: 120 * DAY }));

const target = fc.integer({ min: MINUTE, max: 300 * HOUR });

/** A pause placed relative to the clock's start. A null length means it is still open. */
const pauseSpec = fc.record({
  offset: fc.integer({ min: -2 * DAY, max: 60 * DAY }),
  length: fc.option(fc.integer({ min: 0, max: 10 * DAY }), { nil: null }),
});

/** Any clock input: open and closed pauses, before or after `now`, and maybe a stop. */
const anyClockInput: fc.Arbitrary<SlaClockInput> = fc
  .record({
    startedAt: instant,
    targetMs: target,
    age: fc.integer({ min: -2 * DAY, max: 60 * DAY }),
    pauses: fc.array(pauseSpec, { maxLength: 4 }),
    stopAfter: fc.option(fc.integer({ min: 0, max: 90 * DAY }), { nil: null }),
  })
  .map(({ startedAt, targetMs, age, pauses, stopAfter }) => ({
    startedAt,
    targetMs,
    now: startedAt + age,
    pauses: pauses.map(({ offset, length }) => ({
      from: startedAt + offset,
      to: length === null ? null : startedAt + offset + length,
    })),
    stoppedAt: stopAfter === null ? null : startedAt + stopAfter,
  }));

/** A pause that has ended by `now`, so the clock is running at `now`. */
function endedPause(spec: { offset: number; length: number | null }, startedAt: number, now: number): Pause {
  const from = Math.min(startedAt + spec.offset, now);
  return { from, to: Math.min(from + (spec.length ?? 0), now) };
}

const ids = Object.keys(PRESETS) as PresetId[];

describe.each(ids)("%s calendar", (id) => {
  const cal = PRESETS[id];
  const options = { numRuns: RUNS };

  it("never puts a due time outside working time", () => {
    fc.assert(
      fc.property(instant, positiveDuration, (t, h) => {
        expect(isWorkingTime(cal, addBusinessTime(cal, t, h) - 1)).toBe(true);
      }),
      options,
    );
  });

  it("returns the end of an interval when the time runs out exactly there", () => {
    fc.assert(
      fc.property(instant, (t) => {
        const start = nextWorkingInstant(cal, t);
        const interval = workingIntervals(cal, localDateOf(start, cal.timeZone)).find(
          (candidate) => candidate.start <= start && start < candidate.end,
        );
        if (interval === undefined) throw new Error("The next working instant should sit in an interval.");
        expect(addBusinessTime(cal, t, interval.end - start)).toBe(interval.end);
      }),
      options,
    );
  });

  it("adds a and then b to the same instant as a + b", () => {
    fc.assert(
      fc.property(instant, duration, duration, (t, a, b) => {
        expect(addBusinessTime(cal, addBusinessTime(cal, t, a), b)).toBe(addBusinessTime(cal, t, a + b));
      }),
      options,
    );
  });

  it("measures h of business time from t to add(t, h)", () => {
    fc.assert(
      fc.property(instant, duration, (t, h) => {
        expect(businessTimeBetween(cal, t, addBusinessTime(cal, t, h))).toBe(h);
      }),
      options,
    );
  });

  it("never gives an earlier instant for a longer duration", () => {
    fc.assert(
      fc.property(instant, duration, duration, (t, a, b) => {
        const shorter = Math.min(a, b);
        const longer = Math.max(a, b);
        expect(addBusinessTime(cal, t, shorter)).toBeLessThanOrEqual(addBusinessTime(cal, t, longer));
      }),
      options,
    );
  });

  it("keeps business time between 0 and wall time, with the sign flipped when reversed", () => {
    fc.assert(
      fc.property(instant, gap, (t1, distance) => {
        const t2 = t1 + distance;
        const forward = businessTimeBetween(cal, t1, t2);
        expect(forward).toBeGreaterThanOrEqual(0);
        expect(forward).toBeLessThanOrEqual(t2 - t1);
        expect(businessTimeBetween(cal, t2, t1)).toBe(forward === 0 ? 0 : -forward);
      }),
      options,
    );
  });

  it("never makes a due time earlier by adding a pause", () => {
    const scenario = fc.record({
      startedAt: instant,
      targetMs: target,
      age: fc.integer({ min: 0, max: 60 * DAY }),
      pauses: fc.array(pauseSpec, { maxLength: 3 }),
      extra: pauseSpec,
    });
    fc.assert(
      fc.property(scenario, ({ startedAt, targetMs, age, pauses, extra }) => {
        const now = startedAt + age;
        const base = pauses.map((spec) => endedPause(spec, startedAt, now));
        const without = slaClock(cal, { startedAt, targetMs, now, pauses: base });
        const withPause = slaClock(cal, {
          startedAt,
          targetMs,
          now,
          pauses: [...base, endedPause(extra, startedAt, now)],
        });
        if (without.dueAt === null || withPause.dueAt === null) throw new Error("Both clocks should be running.");
        expect(withPause.dueAt).toBeGreaterThanOrEqual(without.dueAt);
      }),
      options,
    );
  });

  it("adds elapsed and remaining up to the target", () => {
    fc.assert(
      fc.property(anyClockInput, (input) => {
        const clock = slaClock(cal, input);
        expect(clock.elapsedMs + clock.remainingMs).toBe(input.targetMs);
      }),
      options,
    );
  });

  it("reports clock fields that agree with each other", () => {
    fc.assert(
      fc.property(anyClockInput, (input) => {
        const clock = slaClock(cal, input);
        const end = Math.min(input.now, input.stoppedAt ?? Number.POSITIVE_INFINITY);
        expect(clock.dueAt === null).toBe(clock.paused || clock.stopped);
        expect(clock.breachedAt === null).toBe(clock.remainingMs > 0);
        expect(clock.elapsedMs).toBeGreaterThanOrEqual(0);
        expect(clock.elapsedMs).toBeLessThanOrEqual(Math.max(0, businessTimeBetween(cal, input.startedAt, end)));
        if (clock.breachedAt !== null) {
          expect(clock.breachedAt).toBeGreaterThan(input.startedAt);
          expect(clock.breachedAt).toBeLessThanOrEqual(end);
          expect(isWorkingTime(cal, clock.breachedAt - 1)).toBe(true);
        }
        if (clock.dueAt !== null && clock.remainingMs > 0) expect(clock.dueAt).toBeGreaterThan(input.now);
      }),
      options,
    );
  });

  it("finds a next working instant with no working time skipped before it", () => {
    fc.assert(
      fc.property(instant, (t) => {
        const next = nextWorkingInstant(cal, t);
        expect(next).toBeGreaterThanOrEqual(t);
        expect(isWorkingTime(cal, next)).toBe(true);
        expect(businessTimeBetween(cal, t, next)).toBe(0);
      }),
      options,
    );
  });
});
