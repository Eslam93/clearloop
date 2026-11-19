// Update debt: what happened on a request that the customer has not been told yet.
//
// v1 surfaced one risk per request: are we slow (the SLA)? The brief's failure is a second,
// independent risk: does the customer know? Debt measures that one.

import type { DomainEvent, Status } from "./types";

/** Events that change what the customer should know. Internal notes never count. */
export function isCustomerVisibleChange(event: DomainEvent): boolean {
  if (event.visibility !== "customer") return false;
  return (
    event.type === "status_changed" || event.type === "note_added" || event.type === "eta_set"
  );
}

export interface Debt {
  /** Customer-visible changes since the last update the customer received, oldest first. */
  items: DomainEvent[];
  /** When the oldest untold change happened, or null when the customer is up to date. */
  since: number | null;
  /** The customer asked for an update after the last one we sent. */
  customerAsked: boolean;
  askedAt: number | null;
  /** What the customer believes the status is: the status in our last update to them. */
  knownStatus: Status;
  lastToldAt: number | null;
}

/** `events` are one request's events, in any order. */
export function computeDebt(events: DomainEvent[]): Debt {
  const ordered = [...events].sort((x, y) => x.at - y.at || x.id - y.id);
  let lastToldAt: number | null = null;
  let knownStatus: Status = "new";
  for (const event of ordered) {
    if (event.type === "update_sent") {
      lastToldAt = event.at;
      knownStatus = event.status;
    }
  }

  const after = (event: DomainEvent) => lastToldAt === null || event.at > lastToldAt;
  const items = ordered.filter((e) => isCustomerVisibleChange(e) && after(e));
  const ping = ordered.find((e) => e.type === "customer_pinged" && after(e));

  return {
    items,
    since: items[0]?.at ?? null,
    customerAsked: ping !== undefined,
    askedAt: ping?.at ?? null,
    knownStatus,
    lastToldAt,
  };
}

/** How behind the customer is, in plain counts, for a row badge. */
export function debtCount(debt: Debt): number {
  return debt.items.length;
}

const TIER_WEIGHT = { standard: 1, pro: 1.5, vip: 2 } as const;

/**
 * Order for the Owed updates view: a customer who asked comes first, then the oldest debt weighted
 * by tier. Ties go to the request whose SLA is closer (smaller remaining time).
 */
export function owedOrder(
  a: { debt: Debt; tier: keyof typeof TIER_WEIGHT; slaRemainingMs: number },
  b: { debt: Debt; tier: keyof typeof TIER_WEIGHT; slaRemainingMs: number },
  now: number,
): number {
  if (a.debt.customerAsked !== b.debt.customerAsked) return a.debt.customerAsked ? -1 : 1;
  const score = (x: typeof a) =>
    x.debt.since === null ? 0 : (now - x.debt.since) * TIER_WEIGHT[x.tier];
  const diff = score(b) - score(a);
  if (diff !== 0) return diff;
  return a.slaRemainingMs - b.slaRemainingMs;
}
