import { describe, expect, it } from "vitest";
import { presetCalendar, slaClock } from "../src/index";
import { HOUR, MINUTE, at } from "./helpers";

const sa = presetCalendar("SA");

// A Saudi ticket opened on Thursday 2026-11-12 at 15:00 with a 4-hour target.
// Thursday gives 2 business hours, then Friday and Saturday are off.
const startedAt = at("2026-11-12T15:00+03:00");
const targetMs = 4 * HOUR;
const riyadh = (local: string) => at(`${local}+03:00`);

describe("slaClock", () => {
  it("runs across the weekend", () => {
    expect(slaClock(sa, { startedAt, targetMs, now: riyadh("2026-11-15T09:30") })).toEqual({
      elapsedMs: 3.5 * HOUR,
      remainingMs: 0.5 * HOUR,
      paused: false,
      dueAt: riyadh("2026-11-15T10:00"),
      breachedAt: null,
      stopped: false,
    });
  });

  it("stands still over the weekend when read with a time machine", () => {
    const thursday = slaClock(sa, { startedAt, targetMs, now: riyadh("2026-11-12T16:30") });
    const saturday = slaClock(sa, { startedAt, targetMs, now: riyadh("2026-11-14T12:00") });
    expect(thursday.remainingMs).toBe(2.5 * HOUR);
    expect(saturday.remainingMs).toBe(2 * HOUR);
    expect(thursday.dueAt).toBe(riyadh("2026-11-15T10:00"));
    expect(saturday.dueAt).toBe(riyadh("2026-11-15T10:00"));
  });

  it("records when it breached", () => {
    expect(slaClock(sa, { startedAt, targetMs, now: riyadh("2026-11-15T11:00") })).toEqual({
      elapsedMs: 5 * HOUR,
      remainingMs: -1 * HOUR,
      paused: false,
      dueAt: riyadh("2026-11-15T10:00"),
      breachedAt: riyadh("2026-11-15T10:00"),
      stopped: false,
    });
  });

  it("counts as breached the moment elapsed time reaches the target", () => {
    expect(slaClock(sa, { startedAt, targetMs, now: riyadh("2026-11-15T10:00") })).toEqual({
      elapsedMs: 4 * HOUR,
      remainingMs: 0,
      paused: false,
      dueAt: riyadh("2026-11-15T10:00"),
      breachedAt: riyadh("2026-11-15T10:00"),
      stopped: false,
    });
  });

  it("stops counting while waiting on the customer", () => {
    const clock = slaClock(sa, {
      startedAt,
      targetMs,
      now: riyadh("2026-11-15T11:00"),
      pauses: [{ from: riyadh("2026-11-15T08:00"), to: null }],
    });
    expect(clock).toEqual({
      elapsedMs: 2 * HOUR,
      remainingMs: 2 * HOUR,
      paused: true,
      dueAt: null,
      breachedAt: null,
      stopped: false,
    });
  });

  it("merges overlapping pauses given out of order", () => {
    const clock = slaClock(sa, {
      startedAt,
      targetMs,
      now: riyadh("2026-11-15T09:30"),
      pauses: [
        { from: riyadh("2026-11-15T08:30"), to: riyadh("2026-11-15T09:00") },
        { from: riyadh("2026-11-15T08:00"), to: riyadh("2026-11-15T08:45") },
      ],
    });
    // Paused from 08:00 to 09:00 on Sunday, so Sunday counts 30 minutes.
    expect(clock.elapsedMs).toBe(2 * HOUR + 30 * MINUTE);
    expect(clock.paused).toBe(false);
    expect(clock.dueAt).toBe(riyadh("2026-11-15T11:00"));
  });

  it("freezes at resolution", () => {
    expect(
      slaClock(sa, { startedAt, targetMs, now: riyadh("2026-11-16T12:00"), stoppedAt: riyadh("2026-11-12T16:30") }),
    ).toEqual({
      elapsedMs: 1.5 * HOUR,
      remainingMs: 2.5 * HOUR,
      paused: false,
      dueAt: null,
      breachedAt: null,
      stopped: true,
    });
  });

  it("keeps the breach time of a ticket resolved late", () => {
    const clock = slaClock(sa, {
      startedAt,
      targetMs,
      now: riyadh("2026-11-16T12:00"),
      stoppedAt: riyadh("2026-11-15T10:30"),
    });
    expect(clock.elapsedMs).toBe(4.5 * HOUR);
    expect(clock.breachedAt).toBe(riyadh("2026-11-15T10:00"));
    expect(clock.dueAt).toBeNull();
    expect(clock.stopped).toBe(true);
  });

  it("ignores a stop that has not happened yet at now", () => {
    const clock = slaClock(sa, {
      startedAt,
      targetMs,
      now: riyadh("2026-11-12T16:30"),
      stoppedAt: riyadh("2026-11-15T10:30"),
    });
    expect(clock.stopped).toBe(false);
    expect(clock.elapsedMs).toBe(1.5 * HOUR);
    expect(clock.dueAt).toBe(riyadh("2026-11-15T10:00"));
  });

  it("counts from the start when read before the clock has started", () => {
    const clock = slaClock(sa, { startedAt, targetMs, now: riyadh("2026-11-12T09:00") });
    expect(clock.elapsedMs).toBe(0);
    expect(clock.dueAt).toBe(riyadh("2026-11-15T10:00"));
  });

  it("rejects bad input", () => {
    const now = riyadh("2026-11-15T09:30");
    expect(() => slaClock(sa, { startedAt, targetMs: 0, now })).toThrow(RangeError);
    expect(() => slaClock(sa, { startedAt, targetMs: -HOUR, now })).toThrow(RangeError);
    expect(() => slaClock(sa, { startedAt, targetMs, now, pauses: [{ from: now, to: now - 1 }] })).toThrow(
      "pauses[0] ends before it starts.",
    );
  });
});
