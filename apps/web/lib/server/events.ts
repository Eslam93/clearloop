import "server-only";

import type { RequestEvent } from "@clearloop/db";
import type { DeliveryState, DomainEvent, Status } from "@/lib/domain/types";

/** A database event row as a domain event. Unknown shapes become a plain `created` marker. */
export function toDomainEvent(row: RequestEvent): DomainEvent {
  const base = {
    id: row.id,
    requestId: row.requestId,
    at: row.occurredAt.getTime(),
    visibility: row.visibility,
    actorUserId: row.actorUserId,
  };
  const data = (row.data ?? {}) as Record<string, unknown>;
  const str = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : "");
  switch (row.type) {
    case "status_changed":
      return { ...base, type: "status_changed", from: str("from") as Status, to: str("to") as Status };
    case "note_added":
      return { ...base, type: "note_added", text: str("text") };
    case "eta_set":
      return { ...base, type: "eta_set", eta: data.eta ? Date.parse(String(data.eta)) : null };
    case "customer_pinged":
      return { ...base, type: "customer_pinged", text: str("text") };
    case "update_sent":
      return {
        ...base,
        type: "update_sent",
        notificationId: str("notificationId"),
        channel: str("channel") as "whatsapp" | "email" | "out_of_band",
        status: str("status") as Status,
      };
    case "delivery_updated":
      return {
        ...base,
        type: "delivery_updated",
        notificationId: str("notificationId"),
        state: str("state") as DeliveryState,
      };
    default:
      return { ...base, type: "created" };
  }
}
