import { addIn, betweenIn } from "./business-time";
import { compileCalendar } from "./calendar";
import { assertInstant } from "./dates";
import type { CalendarDefinition, Interval, Pause, SlaClock, SlaClockInput } from "./types";

/** Sorts the pauses and merges the ones that overlap or touch. An open pause ends at Infinity. */
function normalizePauses(pauses: readonly Pause[]): Interval[] {
  const spans: Interval[] = [];
  pauses.forEach((pause, index) => {
    assertInstant(pause.from, `pauses[${index}].from`);
    if (pause.to == null) {
      spans.push({ start: pause.from, end: Number.POSITIVE_INFINITY });
      return;
    }
    assertInstant(pause.to, `pauses[${index}].to`);
    if (pause.to < pause.from) throw new RangeError(`pauses[${index}] ends before it starts.`);
    if (pause.to > pause.from) spans.push({ start: pause.from, end: pause.to });
  });

  spans.sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const span of spans) {
    const last = merged.at(-1);
    if (last !== undefined && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push(span);
  }
  return merged;
}

/** The parts of [start, end) that no pause covers. The pauses must be sorted and merged. */
function runningSegments(start: number, end: number, pauses: readonly Interval[]): Interval[] {
  const segments: Interval[] = [];
  let cursor = start;
  for (const pause of pauses) {
    if (cursor >= end || pause.start >= end) break;
    if (pause.end <= cursor) continue;
    if (pause.start > cursor) segments.push({ start: cursor, end: pause.start });
    cursor = pause.end;
  }
  if (cursor < end) segments.push({ start: cursor, end });
  return segments;
}

/**
 * Reads an SLA clock at `now`. The clock counts business time from `startedAt`,
 * skips pauses, and stops at `stoppedAt`. Pauses and stops after `now` have not
 * happened yet, so reading the clock at an earlier `now` gives an earlier picture.
 */
export function slaClock(cal: CalendarDefinition, input: SlaClockInput): SlaClock {
  const { startedAt, targetMs, now } = input;
  assertInstant(startedAt, "startedAt");
  assertInstant(now, "now");
  if (typeof targetMs !== "number" || !Number.isFinite(targetMs) || targetMs <= 0) {
    throw new RangeError(`targetMs must be a positive, finite number of milliseconds, got ${String(targetMs)}.`);
  }
  const stoppedAt = input.stoppedAt ?? null;
  if (stoppedAt !== null) assertInstant(stoppedAt, "stoppedAt");

  const c = compileCalendar(cal);
  const pauses = normalizePauses(input.pauses ?? []);

  const stopped = stoppedAt !== null && stoppedAt <= now;
  const end = stoppedAt !== null && stopped ? stoppedAt : now;
  const paused =
    !stopped && now >= startedAt && pauses.some((pause) => pause.start <= now && now < pause.end);

  let elapsedMs = 0;
  let breachedAt: number | null = null;
  for (const segment of runningSegments(startedAt, end, pauses)) {
    const worked = betweenIn(c, segment.start, segment.end);
    if (breachedAt === null && elapsedMs + worked >= targetMs) {
      // The first instant in this segment at which the target is reached.
      breachedAt = addIn(c, segment.start, targetMs - elapsedMs);
    }
    elapsedMs += worked;
  }
  const remainingMs = targetMs - elapsedMs;

  let dueAt: number | null = null;
  if (!paused && !stopped) {
    // Assumes no further pauses. A clock that has not started yet counts from its start.
    dueAt = remainingMs > 0 ? addIn(c, Math.max(now, startedAt), remainingMs) : breachedAt;
  }

  return { elapsedMs, remainingMs, paused, dueAt, breachedAt, stopped };
}
