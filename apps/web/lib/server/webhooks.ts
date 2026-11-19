import "server-only";

// Delivery receipts. The webhook carries only the provider's message id, so the tenant is found
// through one narrow privileged lookup (tenant_for_provider_message) and everything after runs
// under row-level security. The sandbox channel signs its own simulated receipts with the same
// secret and calls handleDeliveryWebhook, so they take exactly this path.

import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, schema, tenantForProviderMessage, withTenant } from "@clearloop/db";
import type { DeliveryState } from "@/lib/domain/types";
import { webhookSecret } from "./config";
import { ApiError } from "./http";
import { virtualNowFor } from "./tenant";

export function signWebhook(rawBody: string, secret = webhookSecret()): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

export function verifyWebhook(rawBody: string, header: string | null, secret = webhookSecret()): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(signWebhook(rawBody, secret));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

interface StatusEntry {
  id?: string;
  status?: string;
  timestamp?: string;
}

interface WebhookPayload {
  entry?: Array<{ changes?: Array<{ value?: { statuses?: StatusEntry[] } }> }>;
}

const RANK: Record<string, number> = { queued: 0, failed: 0, sent: 1, delivered: 2, read: 3 };
const ACCEPTED = new Set(["sent", "delivered", "read", "failed"]);

/** Applies every status in a WhatsApp-shaped payload. Returns how many changed a notification. */
export async function handleDeliveryWebhook(rawBody: string, signature: string | null): Promise<number> {
  if (!verifyWebhook(rawBody, signature)) throw new ApiError("bad_signature", "The signature does not match.");
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    throw new ApiError("invalid_body", "The body is not valid JSON.");
  }
  const statuses = (payload.entry ?? [])
    .flatMap((e) => e.changes ?? [])
    .flatMap((c) => c.value?.statuses ?? [])
    .filter((s): s is Required<StatusEntry> => !!s.id && !!s.status && ACCEPTED.has(s.status));

  let applied = 0;
  for (const status of statuses) {
    const tenantId = await tenantForProviderMessage(status.id);
    if (!tenantId) continue; // not ours, or the sandbox has been purged
    applied += await withTenant({ tenantId }, async (tx) => {
      const [n] = await tx
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.providerMessageId, status.id))
        .for("update");
      if (!n) return 0;
      const next = status.status as DeliveryState;
      // Receipts arrive out of order; never move backwards (read beats delivered beats sent).
      if (next !== "failed" && (RANK[next] ?? 0) <= (RANK[n.deliveryState] ?? 0)) return 0;
      const now = new Date(await virtualNowFor(tx));
      await tx
        .update(schema.notifications)
        .set({
          deliveryState: next,
          deliveredAt: next === "delivered" || next === "read" ? (n.deliveredAt ?? now) : n.deliveredAt,
          readAt: next === "read" ? now : n.readAt,
        })
        .where(eq(schema.notifications.id, n.id));
      await tx.insert(schema.requestEvents).values({
        tenantId,
        requestId: n.requestId,
        type: "delivery_updated",
        visibility: "internal",
        occurredAt: now,
        data: { notificationId: n.id, state: next },
      });
      return 1;
    });
  }
  return applied;
}

/** A WhatsApp-shaped status payload, as the sandbox channel's simulated provider sends it. */
export function statusPayload(providerMessageId: string, status: "delivered" | "read"): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              statuses: [{ id: providerMessageId, status, timestamp: String(Math.floor(Date.now() / 1000)) }],
            },
          },
        ],
      },
    ],
  });
}
