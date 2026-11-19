import "server-only";

// Loop metrics for the last 30 days of the tenant's clock, computed from the event log.

import { episodes, summarize, within, type Episode, type LoopMetrics } from "@/lib/domain/metrics";
import type { DomainEvent } from "@/lib/domain/types";
import type { ConsoleData } from "@/lib/view/types";

const DAY = 86_400_000;
const WINDOW = 30 * DAY;
const WEEKS = 5;

export interface Group {
  key: string;
  label: string;
  metrics: LoopMetrics;
  behindNow: number;
}

export interface Insights {
  now: number;
  overall: LoopMetrics;
  behindNow: number;
  oldestUntold: number | null;
  byAm: Group[];
  byTier: Group[];
  weekly: Array<{ start: number; end: number; metrics: LoopMetrics }>;
}

/** Rebuilds domain events from the console's timelines (the same rows, already loaded). */
function domainEvents(data: ConsoleData): DomainEvent[] {
  return data.requests.flatMap((r) =>
    r.timeline.map((e) => {
      const base = { id: e.id, requestId: r.id, at: e.at, visibility: e.visibility, actorUserId: null };
      switch (e.type) {
        case "status_changed":
          return { ...base, type: "status_changed", from: e.from!, to: e.to! } as DomainEvent;
        case "note_added":
          return { ...base, type: "note_added", text: e.text ?? "" } as DomainEvent;
        case "eta_set":
          return { ...base, type: "eta_set", eta: e.eta ?? null } as DomainEvent;
        case "customer_pinged":
          return { ...base, type: "customer_pinged", text: e.text ?? "" } as DomainEvent;
        case "update_sent":
          return { ...base, type: "update_sent", notificationId: e.notificationId ?? "", channel: e.channel ?? "whatsapp", status: r.status } as DomainEvent;
        case "delivery_updated":
          return { ...base, type: "delivery_updated", notificationId: e.notificationId ?? "", state: e.state ?? "sent" } as DomainEvent;
        default:
          return { ...base, type: "created" } as DomainEvent;
      }
    }),
  );
}

export function computeInsights(data: ConsoleData): Insights {
  const now = data.now;
  const events = domainEvents(data);
  const byRequest = new Map<string, Episode[]>();
  for (const r of data.requests) byRequest.set(r.id, episodes(r.id, events.filter((e) => e.requestId === r.id)));
  const recent = (ids: string[]) => within(ids.flatMap((id) => byRequest.get(id) ?? []), now - WINDOW, now + 1);

  const behind = (list: ConsoleData["requests"]) => list.filter((r) => r.debt.count > 0 || r.debt.customerAsked).length;

  const ams = data.users.filter((u) => u.role === "am");
  const byAm: Group[] = ams.map((am) => {
    const owned = data.requests.filter((r) => r.customer.ownerId === am.id);
    return { key: am.handle, label: am.name, metrics: summarize(recent(owned.map((r) => r.id))), behindNow: behind(owned) };
  });

  const byTier: Group[] = (["vip", "pro", "standard"] as const).map((tier) => {
    const list = data.requests.filter((r) => r.customer.tier === tier);
    return { key: tier, label: tier, metrics: summarize(recent(list.map((r) => r.id))), behindNow: behind(list) };
  });

  const all = data.requests.map((r) => r.id);
  const weekly = Array.from({ length: WEEKS }, (_, i) => {
    const end = now - (WEEKS - 1 - i) * 7 * DAY;
    const start = end - 7 * DAY;
    return { start, end, metrics: summarize(within(all.flatMap((id) => byRequest.get(id) ?? []), start, end + 1)) };
  });

  const sinces = data.requests.map((r) => r.debt.since).filter((s): s is number => s !== null);
  return {
    now,
    overall: summarize(recent(all)),
    behindNow: behind(data.requests),
    oldestUntold: sinces.length ? Math.min(...sinces) : null,
    byAm,
    byTier,
    weekly,
  };
}
