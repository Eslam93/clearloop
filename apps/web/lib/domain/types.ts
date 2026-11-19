// Domain types. Pure data: safe on the server and in the browser.

export const STATUSES = [
  "new",
  "triage",
  "in_progress",
  "blocked",
  "waiting_on_customer",
  "resolved",
] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TIERS = ["standard", "pro", "vip"] as const;
export type Tier = (typeof TIERS)[number];

export type Language = "ar" | "en";
export type Channel = "whatsapp" | "email" | "out_of_band";
export type Visibility = "internal" | "customer";
export type DeliveryState = "queued" | "sent" | "delivered" | "read" | "failed" | "logged";
export type TemplateId = "status_update" | "request_info" | "resolved";

interface EventBase {
  id: number;
  requestId: string;
  /** Virtual time, epoch ms. */
  at: number;
  visibility: Visibility;
  actorUserId: string | null;
}

export type DomainEvent =
  | (EventBase & { type: "created" })
  | (EventBase & { type: "status_changed"; from: Status; to: Status })
  | (EventBase & { type: "note_added"; text: string })
  | (EventBase & { type: "eta_set"; eta: number | null })
  | (EventBase & { type: "customer_pinged"; text: string })
  | (EventBase & {
      type: "update_sent";
      notificationId: string;
      channel: Channel;
      status: Status;
    })
  | (EventBase & { type: "delivery_updated"; notificationId: string; state: DeliveryState });

export type EventType = DomainEvent["type"];
