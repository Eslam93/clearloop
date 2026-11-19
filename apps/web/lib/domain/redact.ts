// What a customer may see of a request: the redaction layer for the customer status page.
// Internal notes, delivery mechanics and the names of people the customer never deals with are
// removed here, in one place, before anything reaches a customer-facing page.

import type { DomainEvent, Status } from "./types";

export type CustomerEvent =
  | { kind: "created"; at: number }
  | { kind: "status"; at: number; to: Status }
  | { kind: "note"; at: number; text: string }
  | { kind: "update"; at: number }
  | { kind: "eta"; at: number; eta: number | null };

export function customerTimeline(events: DomainEvent[]): CustomerEvent[] {
  const out: CustomerEvent[] = [];
  for (const e of [...events].sort((a, b) => a.at - b.at || a.id - b.id)) {
    if (e.visibility !== "customer") continue;
    switch (e.type) {
      case "created":
        out.push({ kind: "created", at: e.at });
        break;
      case "status_changed":
        out.push({ kind: "status", at: e.at, to: e.to });
        break;
      case "note_added":
        out.push({ kind: "note", at: e.at, text: e.text });
        break;
      case "update_sent":
        if (e.channel !== "out_of_band") out.push({ kind: "update", at: e.at });
        break;
      case "eta_set":
        out.push({ kind: "eta", at: e.at, eta: e.eta });
        break;
      // customer_pinged is the customer's own message; delivery_updated is internal mechanics.
    }
  }
  return out;
}
