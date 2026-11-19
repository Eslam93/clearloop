// The public API contract, written once. Route handlers parse with these schemas, the browser
// client sends with them, and /api/openapi.json is generated from them (z.toJSONSchema), so the
// docs cannot drift from what the server accepts.

import { z } from "zod";
import { PRIORITIES, STATUSES, TIERS } from "@/lib/domain/types";

export const Status = z.enum(STATUSES);
export const Priority = z.enum(PRIORITIES);
export const Tier = z.enum(TIERS);
export const Language = z.enum(["ar", "en"]);
export const Channel = z.enum(["whatsapp", "email", "out_of_band"]);
export const DeliveryState = z.enum(["queued", "sent", "delivered", "read", "failed", "logged"]);
export const Visibility = z.enum(["internal", "customer"]);

const note = z.string().trim().max(1000);

export const NotifyBody = z
  .object({
    request_version: z.number().int().positive().describe("The version the account manager saw."),
    channel: z.enum(["whatsapp", "email"]).optional().describe("Defaults to the customer's preferred channel."),
    note: note.nullish().describe("The account manager's own words, where the template allows them."),
    other_note: note.nullish().describe("The same note in the customer's other language."),
    acknowledged: z
      .array(z.string())
      .default([])
      .describe("Pre-send warnings the account manager saw and chose to send anyway."),
    allow_repeat: z
      .boolean()
      .default(false)
      .describe("Send even though the same update went out in the last five minutes."),
  })
  .strict();

export const LogUpdateBody = z
  .object({
    request_version: z.number().int().positive(),
    note: note.nullish(),
  })
  .strict();

export const StatusBody = z
  .object({
    to: Status,
    note: note.nullish(),
    note_visibility: Visibility.default("customer"),
  })
  .strict();

export const NoteBody = z.object({ text: note.min(1), visibility: Visibility }).strict();

export const EtaBody = z.object({ eta: z.iso.datetime({ offset: true }).nullable() }).strict();

export const PresenceBody = z.object({ request_id: z.uuid().nullable() }).strict();

export const ClockBody = z
  .object({
    jump: z.enum(["plus_hour", "next_morning", "thursday_afternoon", "after_weekend", "ramadan"]),
  })
  .strict();

export const SandboxSettingsBody = z
  .object({
    customer_portal_enabled: z.boolean().optional(),
    device_offline: z.boolean().optional(),
  })
  .strict();

export const DeviceReadBody = z.object({ notification_id: z.uuid() }).strict();
export const DeviceReplyBody = z
  .object({ customer_id: z.uuid(), text: z.string().trim().min(1).max(500) })
  .strict();

export const NotificationOut = z.object({
  notification_id: z.uuid(),
  sent_at: z.iso.datetime(),
  channel: Channel,
  template: z.string(),
  language: Language,
  status_at_send: Status,
  delivery_state: DeliveryState,
  idempotent: z.boolean().describe("True when this response replays an earlier send."),
});

export const RequestSnapshot = z.object({
  id: z.uuid(),
  status: Status,
  version: z.number().int(),
  eta_at: z.iso.datetime().nullable(),
  last_change_at: z.iso.datetime().nullable(),
  last_change_by: z.string().nullable(),
});

export const StaleError = z.object({
  error: z.object({
    code: z.literal("stale_request"),
    message: z.string(),
    details: z.object({ current: RequestSnapshot, your_version: z.number().int() }),
  }),
});

export const ErrorEnvelope = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

export const RequestSummaryOut = z.object({
  id: z.uuid(),
  number: z.number().int(),
  title: z.string(),
  status: Status,
  priority: Priority,
  version: z.number().int(),
  customer: z.object({ id: z.uuid(), name: z.string(), tier: Tier }),
  sla: z.object({
    state: z.enum(["on_track", "at_risk", "breached", "paused", "met", "missed"]),
    remaining_ms: z.number(),
    due_at: z.iso.datetime().nullable(),
  }),
  debt: z.object({
    count: z.number().int(),
    since: z.iso.datetime().nullable(),
    customer_asked: z.boolean(),
  }),
  last_told_at: z.iso.datetime().nullable(),
});

export const RequestListOut = z.object({
  items: z.array(RequestSummaryOut),
  total: z.number().int(),
  now: z.iso.datetime().describe("The tenant's clock. The demo runs on a virtual clock."),
});

export const ListQuery = z.object({
  view: z.enum(["owed", "breaching", "waiting", "open", "resolved", "all"]).default("open"),
  owner: z.enum(["me", "all"]).default("me"),
});

export type NotifyBodyT = z.infer<typeof NotifyBody>;
