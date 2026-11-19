import "server-only";

import type { RequestView } from "@/lib/view/types";

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

/** The public API's summary shape (snake_case, ISO times), matching RequestSummaryOut. */
export function toSummary(r: RequestView) {
  return {
    id: r.id,
    number: r.number,
    title: r.title,
    status: r.status,
    priority: r.priority,
    version: r.version,
    customer: { id: r.customer.id, name: r.customer.name, tier: r.customer.tier },
    sla: { state: r.sla.state, remaining_ms: r.sla.remainingMs, due_at: iso(r.sla.dueAt) },
    debt: { count: r.debt.count, since: iso(r.debt.since), customer_asked: r.debt.customerAsked },
    last_told_at: iso(r.debt.lastToldAt),
  };
}

/** The detail shape: the summary plus the customer-facing timeline and sent updates. */
export function toDetail(r: RequestView) {
  return {
    ...toSummary(r),
    eta_at: iso(r.etaAt),
    opened_at: iso(r.openedAt),
    timeline: r.timeline.map((e) => ({
      id: e.id,
      type: e.type,
      at: iso(e.at),
      visibility: e.visibility,
      actor: e.actorName,
      from: e.from,
      to: e.to,
      text: e.text,
    })),
    updates: r.notifications.map((n) => ({
      id: n.id,
      channel: n.channel,
      delivery_state: n.deliveryState,
      sent_at: iso(n.sentAt),
      read_at: iso(n.readAt),
    })),
  };
}
