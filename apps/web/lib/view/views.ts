// Which requests each view shows, and in what order. Pure, so the browser switches views without
// asking the server and the API route filters the same way.

import { owedOrder } from "@/lib/domain/debt";
import { SLA_ORDER } from "@/lib/domain/sla";
import type { RequestView, ViewId } from "./types";

export function inView(view: ViewId, r: RequestView): boolean {
  switch (view) {
    case "owed":
      return r.debt.count > 0 || r.debt.customerAsked;
    case "breaching":
      return r.status !== "resolved" && (r.sla.state === "breached" || r.sla.state === "at_risk");
    case "waiting":
      return r.status === "waiting_on_customer";
    case "open":
      return r.status !== "resolved";
    case "resolved":
      return r.status === "resolved";
  }
}

export function sortForView(view: ViewId, list: RequestView[], now: number): RequestView[] {
  const sorted = [...list];
  if (view === "owed") {
    return sorted.sort((a, b) =>
      owedOrder(
        { debt: { ...a.debt, items: [] }, tier: a.customer.tier, slaRemainingMs: a.sla.remainingMs },
        { debt: { ...b.debt, items: [] }, tier: b.customer.tier, slaRemainingMs: b.sla.remainingMs },
        now,
      ),
    );
  }
  if (view === "resolved") return sorted.sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0));
  return sorted.sort(
    (a, b) => SLA_ORDER[a.sla.state] - SLA_ORDER[b.sla.state] || a.sla.remainingMs - b.sla.remainingMs,
  );
}
