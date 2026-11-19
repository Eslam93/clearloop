// A request's SLA in business time. The clock runs in the customer's calendar, and stops while
// the request is waiting on the customer or resolved: v1's req_02 ("need a sample export from the
// customer") showed as breached while the customer held it, which is the case this fixes.

import { slaClock, type CalendarDefinition, type Pause } from "@clearloop/business-time";
import type { DomainEvent, Status } from "./types";

export type SlaState = "on_track" | "at_risk" | "breached" | "paused" | "met" | "missed";

export interface SlaView {
  state: SlaState;
  remainingMs: number;
  dueAt: number | null;
  targetMs: number;
  elapsedMs: number;
  breachedAt: number | null;
}

const RUNNING = (status: Status) => status !== "waiting_on_customer" && status !== "resolved";
const HOUR = 3_600_000;

/** At risk: within a quarter of the target, but never more than four business hours out. */
export function atRiskThreshold(targetMs: number): number {
  return Math.min(4 * HOUR, targetMs * 0.25);
}

export function requestSla(input: {
  calendar: CalendarDefinition;
  openedAt: number;
  status: Status;
  events: DomainEvent[];
  targetMinutes: number;
  now: number;
}): SlaView {
  const targetMs = input.targetMinutes * 60_000;
  const changes = input.events
    .filter((e): e is Extract<DomainEvent, { type: "status_changed" }> => e.type === "status_changed")
    .sort((a, b) => a.at - b.at || a.id - b.id);

  const pauses: Pause[] = [];
  let open: number | null = null;
  let previous: Status = "new";
  for (const change of changes) {
    if (RUNNING(previous) && !RUNNING(change.to)) open = change.at;
    if (!RUNNING(previous) && RUNNING(change.to) && open !== null) {
      pauses.push({ from: open, to: change.at });
      open = null;
    }
    previous = change.to;
  }

  let stoppedAt: number | null = null;
  if (input.status === "resolved") stoppedAt = open ?? input.now;
  else if (open !== null) pauses.push({ from: open, to: null });

  const clock = slaClock(input.calendar, {
    startedAt: input.openedAt,
    targetMs,
    now: input.now,
    pauses,
    stoppedAt,
  });

  let state: SlaState;
  if (input.status === "resolved") state = clock.breachedAt === null ? "met" : "missed";
  else if (input.status === "waiting_on_customer") state = "paused";
  else if (clock.remainingMs <= 0) state = "breached";
  else if (clock.remainingMs <= atRiskThreshold(targetMs)) state = "at_risk";
  else state = "on_track";

  return {
    state,
    remainingMs: clock.remainingMs,
    dueAt: clock.dueAt,
    targetMs,
    elapsedMs: clock.elapsedMs,
    breachedAt: clock.breachedAt,
  };
}

/** Sort order for SLA risk: breached, at risk, on track, then paused, then closed. */
export const SLA_ORDER: Record<SlaState, number> = {
  breached: 0,
  at_risk: 1,
  on_track: 2,
  paused: 3,
  missed: 4,
  met: 5,
};
