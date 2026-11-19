import "server-only";

// The outbox. A notification row is the message to send; it is written in the same transaction as
// the update_sent event, so a crash can never lose one or send one that was not recorded.
//
// Sending happens outside any database transaction, in three steps:
//   1. claim: take due rows with FOR UPDATE SKIP LOCKED and push next_attempt_at out as a lease;
//   2. send through the channel adapter;
//   3. record the result, or schedule a retry with backoff for a transient failure.
// If the process dies between 1 and 3, the lease runs out and the sweeper retries the row. That is
// at-least-once delivery: a crash after the provider accepted a message can repeat it (see
// docs/decisions).

import { and, asc, eq, inArray, lte, schema, sql, tenantsWithDueOutbox, withTenant } from "@clearloop/db";
import {
  MAX_ATTEMPTS,
  nextAttemptDelay,
  sandboxAdapter,
  TransientChannelError,
  type ChannelAdapter,
} from "./channels";
import { handleDeliveryWebhook, signWebhook, statusPayload } from "./webhooks";
import { virtualNowFor } from "./tenant";
import { noteRule } from "@/lib/domain/window";
import type { TemplateId } from "@/lib/domain/types";

const LEASE_MS = 60_000;

/** The adapter for a channel. The demo (and any deployment without credentials) uses the sandbox. */
function adapterFor(): ChannelAdapter {
  return sandboxAdapter;
}

/** Sends this tenant's due messages. Returns how many went out. */
export async function dispatchDue(tenantId: string, onlyId?: string): Promise<number> {
  const claimed = await withTenant({ tenantId }, async (tx) => {
    const due = await tx
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.deliveryState, "queued"),
          lte(schema.notifications.nextAttemptAt, new Date()),
          onlyId ? eq(schema.notifications.id, onlyId) : undefined,
        ),
      )
      .orderBy(asc(schema.notifications.createdAt))
      .limit(10)
      .for("update", { skipLocked: true });
    if (due.length === 0) return [];
    const rows = await tx
      .update(schema.notifications)
      .set({
        nextAttemptAt: new Date(Date.now() + LEASE_MS),
        attempts: sql`${schema.notifications.attempts} + 1`,
      })
      .where(inArray(schema.notifications.id, due.map((d) => d.id)))
      .returning();
    const [tenant] = await tx.select().from(schema.tenants).limit(1);
    const customers = await tx
      .select()
      .from(schema.customers)
      .where(inArray(schema.customers.id, [...new Set(rows.map((r) => r.customerId))]));
    const now = await virtualNowFor(tx);
    return rows.map((row) => ({ row, offline: tenant?.deviceOffline ?? false, customer: customers.find((c) => c.id === row.customerId)!, now }));
  });

  let sent = 0;
  for (const { row, offline, customer, now } of claimed) {
    const adapter = adapterFor();
    const freeText = noteRule(row.channel as "whatsapp" | "email", row.template as TemplateId, customer.lastInboundAt?.getTime() ?? null, now).allowed;
    try {
      const result = await adapter.send(
        {
          notificationId: row.id,
          channel: row.channel as "whatsapp" | "email",
          template: row.template,
          language: row.language,
          body: row.body,
          freeText,
          to: { name: customer.contactName },
        },
        { offline },
      );
      await withTenant({ tenantId }, async (tx) => {
        const at = new Date(await virtualNowFor(tx));
        await tx
          .update(schema.notifications)
          .set({ deliveryState: "sent", providerMessageId: result.providerMessageId, lastError: null, nextAttemptAt: null })
          .where(eq(schema.notifications.id, row.id));
        await tx.insert(schema.requestEvents).values({
          tenantId,
          requestId: row.requestId,
          type: "delivery_updated",
          visibility: "internal",
          occurredAt: at,
          data: { notificationId: row.id, state: "sent" },
        });
      });
      sent += 1;
      // The sandbox provider confirms delivery at once, through the signed webhook path.
      if (adapter === sandboxAdapter) {
        const payload = statusPayload(result.providerMessageId, "delivered");
        await handleDeliveryWebhook(payload, signWebhook(payload));
      }
    } catch (error) {
      const transient = error instanceof TransientChannelError;
      const giveUp = !transient || row.attempts >= MAX_ATTEMPTS;
      await withTenant({ tenantId }, async (tx) => {
        await tx
          .update(schema.notifications)
          .set({
            deliveryState: giveUp ? "failed" : "queued",
            lastError: (error as Error).message.slice(0, 300),
            nextAttemptAt: giveUp
              ? null
              : new Date(Date.now() + nextAttemptDelay(row.attempts, transient ? error.retryAfterMs : null)),
          })
          .where(eq(schema.notifications.id, row.id));
        if (giveUp) {
          await tx.insert(schema.requestEvents).values({
            tenantId,
            requestId: row.requestId,
            type: "delivery_updated",
            visibility: "internal",
            occurredAt: new Date(await virtualNowFor(tx)),
            data: { notificationId: row.id, state: "failed" },
          });
        }
      });
    }
  }
  return sent;
}

/** The cross-tenant sweep, run by the cron endpoint. */
export async function sweepAll(limit = 50): Promise<number> {
  let total = 0;
  for (const tenantId of await tenantsWithDueOutbox(limit)) total += await dispatchDue(tenantId);
  return total;
}
