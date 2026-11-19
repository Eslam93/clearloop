// The server's claims, tested on real Postgres through the app role (row-level security on).
// Each test seeds its own sandbox tenant, exactly as a visitor gets one.

import { closeDatabase, eq, schema, withTenant, type Tx, type User } from "@clearloop/db";
import { afterAll, describe, expect, it } from "vitest";
import { virtualNow } from "@/lib/domain/clock";
import { resolveActor } from "@/lib/server/actor";
import { loadConsole } from "@/lib/server/console";
import { ApiError } from "@/lib/server/http";
import { dispatchDue } from "@/lib/server/outbox";
import { changeStatus, logUpdate, notify } from "@/lib/server/requests";
import { newTenantId, seedSandbox } from "@/lib/server/seed";
import { handleDeliveryWebhook, signWebhook, statusPayload } from "@/lib/server/webhooks";

const DAY = 86_400_000;
afterAll(() => closeDatabase());

async function sandbox(): Promise<string> {
  const tenantId = newTenantId();
  await withTenant({ tenantId }, (tx) => seedSandbox(tx, tenantId, Date.now(), new Date(Date.now() + DAY)));
  return tenantId;
}

async function as<T>(tenantId: string, handle: string, fn: (ctx: { tx: Tx; actor: User; now: number }) => Promise<T>) {
  return withTenant({ tenantId }, async (tx) => {
    const actor = await resolveActor(tx, handle);
    const [tenant] = await tx.select().from(schema.tenants);
    return fn({ tx, actor, now: virtualNow(tenant!.clockOffsetMs) });
  });
}

async function request(tenantId: string, number: number) {
  return withTenant({ tenantId }, async (tx) => {
    const [row] = await tx.select().from(schema.requests).where(eq(schema.requests.number, number));
    return row!;
  });
}

const body = (version: number, extra: Record<string, unknown> = {}) => ({
  request_version: version,
  acknowledged: [] as string[],
  allow_repeat: false,
  ...extra,
});

async function apiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected an ApiError");
}

describe("notify", () => {
  it("refuses a stale version with 409 and a snapshot naming who changed what", async () => {
    const t = await sandbox();
    const r = await request(t, 1042);
    await as(t, "khalid", (ctx) => changeStatus(ctx, r.id, "blocked", null, "customer"));
    const error = await apiError(as(t, "sarah", (ctx) => notify(ctx, r.id, body(r.version), null)));
    expect(error.code).toBe("stale_request");
    expect(error.status).toBe(409);
    const current = (error.details as { current: Record<string, unknown> }).current;
    expect(current).toMatchObject({ status: "blocked", version: r.version + 1, last_change_by: "Khalid Othman", last_change_from: "in_progress", last_change_to: "blocked" });
  });

  it("sends one message when two account managers notify at the same moment", async () => {
    const t = await sandbox();
    const r = await request(t, 1042);
    const results = await Promise.all([
      as(t, "sarah", (ctx) => notify(ctx, r.id, body(r.version), "key-sarah-0001")),
      as(t, "omar", (ctx) => notify(ctx, r.id, body(r.version), "key-omar-00001")),
    ]);
    expect(results.map((x) => x.body.idempotent).sort()).toEqual([false, true]);
    expect(new Set(results.map((x) => x.body.notification_id)).size).toBe(1);
    const sent = await withTenant({ tenantId: t }, (tx) =>
      tx.select().from(schema.notifications).where(eq(schema.notifications.requestId, r.id)),
    );
    // Only one new message reached the customer (the seeded history is excluded).
    expect(sent.filter((n) => !n.bodyHash.startsWith("seed"))).toHaveLength(1);
  });

  it("replays the first response for a repeated Idempotency-Key, and refuses it with another body", async () => {
    const t = await sandbox();
    const r = await request(t, 1047);
    const first = await as(t, "sarah", (ctx) => notify(ctx, r.id, body(r.version, { allow_repeat: true }), "key-replay-001"));
    const again = await as(t, "sarah", (ctx) => notify(ctx, r.id, body(r.version, { allow_repeat: true }), "key-replay-001"));
    expect(again.body).toMatchObject({ notification_id: first.body.notification_id, idempotent: true });
    expect(again.dispatch).toBeNull();
    const error = await apiError(as(t, "sarah", (ctx) => notify(ctx, r.id, body(r.version, { allow_repeat: false }), "key-replay-001")));
    expect(error.code).toBe("idempotency_conflict");
    expect(error.status).toBe(422);
  });

  it("cannot see another tenant's request: not found, never an empty success", async () => {
    const a = await sandbox();
    const b = await sandbox();
    const ra = await request(a, 1042);
    const error = await apiError(as(b, "sarah", (ctx) => notify(ctx, ra.id, body(ra.version), null)));
    expect(error.code).toBe("not_found");
    expect(error.status).toBe(404);
  });

  it("blocks words copied from an internal note, even when acknowledged", async () => {
    const t = await sandbox();
    const r = await request(t, 1045); // Falcon Retail: the WhatsApp window is open
    const note = "Update: the reconciliation job times out on store 14's batch size.";
    const error = await apiError(as(t, "sarah", (ctx) => notify(ctx, r.id, body(r.version, { note, acknowledged: ["internal_note"] }), null)));
    expect(error.code).toBe("blocked_by_check");
    expect((error.details as { findings: Array<{ id: string }> }).findings.map((f) => f.id)).toContain("internal_note");
  });

  it("needs warnings acknowledged before it sends", async () => {
    const t = await sandbox();
    const r = await request(t, 1045);
    const note = "Khalid will have it done today.";
    const error = await apiError(as(t, "sarah", (ctx) => notify(ctx, r.id, body(r.version, { note }), null)));
    expect((error.details as { findings: Array<{ id: string }> }).findings.map((f) => f.id).sort()).toEqual([
      "engineer_name",
      "status_claim",
      "time_promise",
    ]);
    const sent = await as(t, "sarah", (ctx) =>
      notify(ctx, r.id, body(r.version, { note, acknowledged: ["engineer_name", "time_promise", "status_claim"] }), null),
    );
    expect(sent.body.idempotent).toBe(false);
  });

  it("refuses free text outside WhatsApp's 24-hour window", async () => {
    const t = await sandbox();
    const r = await request(t, 1042); // Nour Logistics last wrote more than a day ago
    const error = await apiError(as(t, "sarah", (ctx) => notify(ctx, r.id, body(r.version, { note: "A quick word" }), null)));
    expect(error.code).toBe("note_not_allowed");
  });

  it("closes the debt when the update was given another way", async () => {
    const t = await sandbox();
    const r = await request(t, 1048);
    const before = await as(t, "sarah", (ctx) => loadConsole(ctx.tx, ctx.actor));
    expect(before.requests.find((x) => x.number === 1048)!.debt.count).toBe(1);
    await as(t, "sarah", (ctx) => logUpdate(ctx, r.id, r.version, "Told them on a call"));
    const after = await as(t, "sarah", (ctx) => loadConsole(ctx.tx, ctx.actor));
    expect(after.requests.find((x) => x.number === 1048)!.debt.count).toBe(0);
  });
});

describe("the outbox and receipts", () => {
  it("retries while the phone is offline, then delivers", async () => {
    const t = await sandbox();
    const r = await request(t, 1044);
    await withTenant({ tenantId: t }, (tx) => tx.update(schema.tenants).set({ deviceOffline: true }).where(eq(schema.tenants.id, t)));
    const { body: sent } = await as(t, "sarah", (ctx) => notify(ctx, r.id, body(r.version, { allow_repeat: true }), null));
    expect(await dispatchDue(t, sent.notification_id)).toBe(0);
    const queued = await withTenant({ tenantId: t }, (tx) =>
      tx.select().from(schema.notifications).where(eq(schema.notifications.id, sent.notification_id)),
    );
    expect(queued[0]).toMatchObject({ deliveryState: "queued", attempts: 1 });
    expect(queued[0]!.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());

    await withTenant({ tenantId: t }, async (tx) => {
      await tx.update(schema.tenants).set({ deviceOffline: false }).where(eq(schema.tenants.id, t));
      await tx.update(schema.notifications).set({ nextAttemptAt: new Date(Date.now() - 1000) }).where(eq(schema.notifications.id, sent.notification_id));
    });
    expect(await dispatchDue(t, sent.notification_id)).toBe(1);
    const delivered = await withTenant({ tenantId: t }, (tx) =>
      tx.select().from(schema.notifications).where(eq(schema.notifications.id, sent.notification_id)),
    );
    expect(delivered[0]).toMatchObject({ deliveryState: "delivered", attempts: 2 });
  });

  it("rejects a receipt with a bad signature", async () => {
    const payload = statusPayload("sbx.anything", "read");
    const error = await apiError(handleDeliveryWebhook(payload, "sha256=0000"));
    expect(error.code).toBe("bad_signature");
  });

  it("never moves a message backwards when receipts arrive out of order", async () => {
    const t = await sandbox();
    const r = await request(t, 1044);
    const { body: sent } = await as(t, "sarah", (ctx) => notify(ctx, r.id, body(r.version, { allow_repeat: true }), null));
    await dispatchDue(t, sent.notification_id);
    const providerId = `sbx.${sent.notification_id}`;
    const read = statusPayload(providerId, "read");
    expect(await handleDeliveryWebhook(read, signWebhook(read))).toBe(1);
    const late = statusPayload(providerId, "delivered");
    expect(await handleDeliveryWebhook(late, signWebhook(late))).toBe(0);
  });
});

describe("the demo story", () => {
  it("opens with the states the README describes", async () => {
    const t = await sandbox();
    const data = await as(t, "sarah", (ctx) => loadConsole(ctx.tx, ctx.actor));
    const byNumber = (n: number) => data.requests.find((r) => r.number === n)!;
    expect(byNumber(1042)).toMatchObject({ sla: { state: "at_risk" }, debt: { count: 2, customerAsked: false } });
    expect(byNumber(1045).debt.customerAsked).toBe(true);
    expect(byNumber(1038).sla.state).toBe("paused");
    expect(byNumber(1036).sla.state).toBe("breached");
    expect(byNumber(1050)).toMatchObject({ status: "resolved", debt: { count: 2 } });
  });
});
