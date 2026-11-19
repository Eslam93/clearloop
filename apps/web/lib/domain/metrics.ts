// Ask-first rate and time-to-tell, computed from the event log.
//
// An episode starts at the first customer-visible change the customer has not been told about and
// ends at the next update we send. It is "asked first" if the customer pinged us inside it before
// that update. v1's riskiest assumption was whether account managers would notify proactively;
// this is that question, measured continuously.

import { isCustomerVisibleChange } from "./debt";
import type { DomainEvent } from "./types";

export interface Episode {
  requestId: string;
  startedAt: number;
  /** When we told the customer, or null if we have not yet. */
  toldAt: number | null;
  /** When the customer asked inside the episode, or null. */
  askedAt: number | null;
}

export function episodes(requestId: string, events: DomainEvent[]): Episode[] {
  const ordered = [...events]
    .filter((e) => e.requestId === requestId)
    .sort((x, y) => x.at - y.at || x.id - y.id);
  const found: Episode[] = [];
  let open: Episode | null = null;
  for (const event of ordered) {
    if (isCustomerVisibleChange(event)) {
      open ??= { requestId, startedAt: event.at, toldAt: null, askedAt: null };
    } else if (event.type === "customer_pinged" && open && open.askedAt === null) {
      open.askedAt = event.at;
    } else if (event.type === "update_sent" && open) {
      open.toldAt = event.at;
      found.push(open);
      open = null;
    }
  }
  if (open) found.push(open);
  return found;
}

export interface LoopMetrics {
  /** Episodes that have an outcome: told, or asked. */
  decided: number;
  askedFirst: number;
  /** askedFirst / decided, or null with no decided episodes. */
  askFirstRate: number | null;
  /** Median ms from a change to the customer being told, over told episodes. */
  medianTimeToTellMs: number | null;
  /** Episodes still open, where the customer has not been told. */
  open: number;
}

export function summarize(list: Episode[]): LoopMetrics {
  const asked = list.filter(
    (e) => e.askedAt !== null && (e.toldAt === null || e.askedAt < e.toldAt),
  );
  const told = list.filter((e) => e.toldAt !== null);
  const decided = new Set([...asked, ...told]).size;
  const tellTimes = told.map((e) => e.toldAt! - e.startedAt).sort((x, y) => x - y);
  return {
    decided,
    askedFirst: asked.length,
    askFirstRate: decided === 0 ? null : asked.length / decided,
    medianTimeToTellMs: median(tellTimes),
    open: list.filter((e) => e.toldAt === null).length,
  };
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Episodes that started inside [from, to). */
export function within(list: Episode[], from: number, to: number): Episode[] {
  return list.filter((e) => e.startedAt >= from && e.startedAt < to);
}
