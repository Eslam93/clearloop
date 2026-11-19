import "server-only";

// Writes on a request. Each runs in one withTenant transaction and locks the request row first,
// so concurrent writers on the same request take turns, and every check sees committed state.

import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, inArray, schema, sql, type Tx, type User } from "@clearloop/db";
import type { NotifyBodyT } from "@/lib/api/contracts";
import { blocks, checkMessage, type Finding } from "@/lib/domain/presend";
import { renderMessage, TEMPLATE_NEEDS_NOTE, templateFor } from "@/lib/domain/templates";
import type { Status } from "@/lib/domain/types";
import { noteRule } from "@/lib/domain/window";
import { DATE_LOCALES } from "@/i18n/core";
import { ApiError } from "./http";

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface WriteContext {
  tx: Tx;
  actor: User;
  /** The tenant's virtual now, epoch ms. */
  now: number;
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** Loads and locks a request. Another tenant's id is simply not found: 404, never 200 []. */
async function lockRequest(tx: Tx, requestId: string) {
  const [row] = await tx
    .select()
    .from(schema.requests)
    .where(eq(schema.requests.id, requestId))
    .for("update");
  if (!row) throw new ApiError("not_found", "No such request.");
  return row;
}

async function staleError(tx: Tx, request: typeof schema.requests.$inferSelect, yourVersion: number) {
  const [change] = await tx
    .select({
      type: schema.requestEvents.type,
      data: schema.requestEvents.data,
      occurredAt: schema.requestEvents.occurredAt,
      actorName: schema.users.name,
    })
    .from(schema.requestEvents)
    .leftJoin(schema.users, eq(schema.users.id, schema.requestEvents.actorUserId))
    .where(
      and(
        eq(schema.requestEvents.requestId, request.id),
        inArray(schema.requestEvents.type, ["status_changed", "eta_set"]),
      ),
    )
    .orderBy(desc(schema.requestEvents.id))
    .limit(1);
  const data = (change?.data ?? {}) as { from?: string; to?: string };
  return new ApiError("stale_request", "The request changed since you opened it.", {
    your_version: yourVersion,
    current: {
      id: request.id,
      status: request.status,
      version: request.version,
      eta_at: request.etaAt?.toISOString() ?? null,
      last_change_at: change?.occurredAt.toISOString() ?? null,
      last_change_by: change?.actorName ?? null,
      last_change_type: change?.type ?? null,
      last_change_from: data.from ?? null,
      last_change_to: data.to ?? null,
    },
  });
}

async function loadCustomer(tx: Tx, customerId: string) {
  const [row] = await tx
    .select({ customer: schema.customers, calendar: schema.businessCalendars })
    .from(schema.customers)
    .innerJoin(schema.businessCalendars, eq(schema.businessCalendars.id, schema.customers.calendarId))
    .where(eq(schema.customers.id, customerId));
  if (!row) throw new ApiError("not_found", "No such customer.");
  const timeZone = (row.calendar.definition as { timeZone?: string }).timeZone ?? "UTC";
  return { ...row.customer, timeZone };
}

export function formatEta(eta: Date | null, language: "ar" | "en", timeZone: string): string | null {
  if (!eta) return null;
  return new Intl.DateTimeFormat(DATE_LOCALES[language], {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(eta);
}

export interface NotifyResult {
  status: 200;
  body: {
    notification_id: string;
    sent_at: string;
    channel: "whatsapp" | "email" | "out_of_band";
    template: string;
    language: "ar" | "en";
    status_at_send: Status;
    delivery_state: string;
    idempotent: boolean;
    duplicate_of?: { by: string | null; at: string };
  };
  /** Set when a new message needs dispatching after the transaction commits. */
  dispatch: string | null;
}

function fingerprint(requestId: string, body: NotifyBodyT): string {
  return sha256(
    JSON.stringify({
      requestId,
      v: body.request_version,
      c: body.channel ?? null,
      n: body.note ?? null,
      o: body.other_note ?? null,
      a: [...body.acknowledged].sort(),
      r: body.allow_repeat,
    }),
  );
}

export async function notify(
  ctx: WriteContext,
  requestId: string,
  body: NotifyBodyT,
  idempotencyKey: string | null,
): Promise<NotifyResult> {
  const { tx, actor, now } = ctx;
  const scope = `notify:${requestId}`;
  const print = fingerprint(requestId, body);

  // 1. A retried request with the same Idempotency-Key gets the first response back.
  if (idempotencyKey) {
    const [seen] = await tx
      .select()
      .from(schema.idempotencyKeys)
      .where(and(eq(schema.idempotencyKeys.scope, scope), eq(schema.idempotencyKeys.key, idempotencyKey)));
    if (seen) {
      if (seen.fingerprint !== print) {
        throw new ApiError("idempotency_conflict", "This Idempotency-Key was used with a different body.");
      }
      return { status: 200, body: { ...(seen.response as NotifyResult["body"]), idempotent: true }, dispatch: null };
    }
  }

  // 2. Lock the request, then 3. refuse a stale version.
  const request = await lockRequest(tx, requestId);
  if (body.request_version !== request.version) throw await staleError(tx, request, body.request_version);

  const customer = await loadCustomer(tx, request.customerId);
  const template = templateFor(request.status);
  const channel = body.channel ?? customer.preferredChannel;
  const language = customer.preferredLanguage;

  // 4. The account manager's own words, where the channel and template allow them.
  const note = body.note?.trim() || null;
  const rule = noteRule(channel, template, customer.lastInboundAt?.getTime() ?? null, now);
  if (note && !rule.allowed) {
    throw new ApiError("note_not_allowed", "Outside WhatsApp's 24-hour window only the approved template can be sent.");
  }
  if (!note && TEMPLATE_NEEDS_NOTE[template]) {
    throw new ApiError("note_required", "Say what you need from the customer.");
  }

  // 5. Pre-send checks. A blocking finding stops the send; warnings need acknowledging.
  if (note) {
    const [internal, engineers] = await Promise.all([
      tx
        .select({ data: schema.requestEvents.data })
        .from(schema.requestEvents)
        .where(
          and(
            eq(schema.requestEvents.requestId, request.id),
            eq(schema.requestEvents.type, "note_added"),
            eq(schema.requestEvents.visibility, "internal"),
          ),
        ),
      tx.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.role, "engineer")),
    ]);
    const findings: Finding[] = checkMessage({
      note,
      otherNote: body.other_note ?? null,
      status: request.status,
      hasEta: request.etaAt !== null,
      internalNotes: internal.map((r) => String((r.data as { text?: string }).text ?? "")),
      engineerNames: engineers.map((e) => e.name),
    });
    const unacknowledged = findings.filter((f) => f.severity === "warn" && !body.acknowledged.includes(f.id));
    if (blocks(findings) || unacknowledged.length > 0) {
      throw new ApiError("blocked_by_check", "The message needs another look before it goes out.", {
        findings,
      });
    }
  }

  const amName = actor.role === "am" ? actor.name : (await ownerName(tx, customer.ownerUserId)) ?? actor.name;
  const text = renderMessage(template, language, {
    contactName: customer.contactName,
    requestNumber: request.number,
    requestTitle: request.title,
    status: request.status,
    amName,
    eta: formatEta(request.etaAt, language, customer.timeZone),
    note: [note, body.other_note?.trim()].filter(Boolean).join("\n") || null,
  });
  const bodyHash = sha256(`${template}|${language}|${channel}|${text}`);

  // 6. The same update already went out a moment ago (a second account manager, a double-click
  //    with a fresh key): return that one instead of messaging the customer twice.
  if (!body.allow_repeat) {
    const [recent] = await tx
      .select({ n: schema.notifications, by: schema.users.name })
      .from(schema.notifications)
      .leftJoin(schema.users, eq(schema.users.id, schema.notifications.actorUserId))
      .where(
        and(
          eq(schema.notifications.requestId, request.id),
          eq(schema.notifications.requestVersion, request.version),
          eq(schema.notifications.channel, channel),
          eq(schema.notifications.template, template),
          gt(schema.notifications.createdAt, new Date(Date.now() - DUPLICATE_WINDOW_MS)),
        ),
      )
      .orderBy(desc(schema.notifications.createdAt))
      .limit(1);
    if (recent) {
      const response = { ...notificationBody(recent.n), idempotent: true, duplicate_of: { by: recent.by, at: recent.n.sentAt.toISOString() } };
      await remember(tx, scope, idempotencyKey, print, response);
      return { status: 200, body: response, dispatch: null };
    }
  }

  const [created] = await tx
    .insert(schema.notifications)
    .values({
      tenantId: request.tenantId,
      requestId: request.id,
      customerId: customer.id,
      actorUserId: actor.id,
      channel,
      template,
      language,
      body: text,
      note,
      statusAtSend: request.status,
      requestVersion: request.version,
      bodyHash,
      idempotencyKey,
      deliveryState: "queued",
      nextAttemptAt: new Date(),
      sentAt: new Date(now),
    })
    .returning();
  await tx.insert(schema.requestEvents).values({
    tenantId: request.tenantId,
    requestId: request.id,
    type: "update_sent",
    visibility: "customer",
    actorUserId: actor.id,
    occurredAt: new Date(now),
    data: { notificationId: created!.id, channel, template, status: request.status },
  });

  const response = { ...notificationBody(created!), idempotent: false };
  await remember(tx, scope, idempotencyKey, print, response);
  return { status: 200, body: response, dispatch: created!.id };
}

async function ownerName(tx: Tx, userId: string): Promise<string | null> {
  const [owner] = await tx.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, userId));
  return owner?.name ?? null;
}

function notificationBody(n: typeof schema.notifications.$inferSelect): NotifyResult["body"] {
  return {
    notification_id: n.id,
    sent_at: n.sentAt.toISOString(),
    channel: n.channel,
    template: n.template,
    language: n.language,
    status_at_send: n.statusAtSend as Status,
    delivery_state: n.deliveryState,
    idempotent: false,
  };
}

async function remember(tx: Tx, scope: string, key: string | null, print: string, response: unknown) {
  if (!key) return;
  await tx
    .insert(schema.idempotencyKeys)
    .values({ tenantId: sql`app_current_tenant()`, scope, key, fingerprint: print, statusCode: 200, response })
    .onConflictDoNothing();
}

/** The account manager told the customer some other way: record it so debt matches reality. */
export async function logUpdate(ctx: WriteContext, requestId: string, version: number, note: string | null) {
  const { tx, actor, now } = ctx;
  const request = await lockRequest(tx, requestId);
  if (version !== request.version) throw await staleError(tx, request, version);
  const customer = await loadCustomer(tx, request.customerId);
  const template = templateFor(request.status);
  const [created] = await tx
    .insert(schema.notifications)
    .values({
      tenantId: request.tenantId,
      requestId: request.id,
      customerId: customer.id,
      actorUserId: actor.id,
      channel: "out_of_band",
      template,
      language: customer.preferredLanguage,
      body: note ?? "",
      note,
      statusAtSend: request.status,
      requestVersion: request.version,
      bodyHash: sha256(`out_of_band|${now}|${note ?? ""}`),
      deliveryState: "logged",
      sentAt: new Date(now),
    })
    .returning();
  await tx.insert(schema.requestEvents).values({
    tenantId: request.tenantId,
    requestId: request.id,
    type: "update_sent",
    visibility: "customer",
    actorUserId: actor.id,
    occurredAt: new Date(now),
    data: { notificationId: created!.id, channel: "out_of_band", template, status: request.status },
  });
  return notificationBody(created!);
}

/** An engineer moves the request. The version changes, so open drawers become stale. */
export async function changeStatus(
  ctx: WriteContext,
  requestId: string,
  to: Status,
  note: string | null,
  noteVisibility: "internal" | "customer",
) {
  const { tx, actor, now } = ctx;
  const request = await lockRequest(tx, requestId);
  if (request.status === to && !note) return request;
  const at = new Date(now);
  if (request.status !== to) {
    await tx.insert(schema.requestEvents).values({
      tenantId: request.tenantId,
      requestId: request.id,
      type: "status_changed",
      visibility: "customer",
      actorUserId: actor.id,
      occurredAt: at,
      data: { from: request.status, to },
    });
  }
  if (note) {
    await tx.insert(schema.requestEvents).values({
      tenantId: request.tenantId,
      requestId: request.id,
      type: "note_added",
      visibility: noteVisibility,
      actorUserId: actor.id,
      occurredAt: at,
      data: { text: note },
    });
  }
  const [updated] = await tx
    .update(schema.requests)
    .set({
      status: to,
      version: request.status !== to ? request.version + 1 : request.version,
      resolvedAt: to === "resolved" ? at : null,
    })
    .where(eq(schema.requests.id, request.id))
    .returning();
  return updated!;
}

export async function addNote(ctx: WriteContext, requestId: string, text: string, visibility: "internal" | "customer") {
  const { tx, actor, now } = ctx;
  const request = await lockRequest(tx, requestId);
  await tx.insert(schema.requestEvents).values({
    tenantId: request.tenantId,
    requestId: request.id,
    type: "note_added",
    visibility,
    actorUserId: actor.id,
    occurredAt: new Date(now),
    data: { text },
  });
}

export async function setEta(ctx: WriteContext, requestId: string, eta: Date | null) {
  const { tx, actor, now } = ctx;
  const request = await lockRequest(tx, requestId);
  await tx.insert(schema.requestEvents).values({
    tenantId: request.tenantId,
    requestId: request.id,
    type: "eta_set",
    visibility: "customer",
    actorUserId: actor.id,
    occurredAt: new Date(now),
    data: { eta: eta?.toISOString() ?? null },
  });
  await tx
    .update(schema.requests)
    .set({ etaAt: eta, version: request.version + 1 })
    .where(eq(schema.requests.id, request.id));
}

/** A signed, expiring link to the customer status page. Only the token's hash is stored. */
export async function createCustomerLink(tx: Tx, requestId: string): Promise<{ token: string; expiresAt: Date }> {
  const request = await lockRequest(tx, requestId);
  const [tenant] = await tx.select().from(schema.tenants).where(eq(schema.tenants.id, request.tenantId));
  if (!tenant?.customerPortalEnabled) throw new ApiError("forbidden", "The customer status page is off.");
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Math.min(Date.now() + LINK_TTL_MS, tenant.expiresAt?.getTime() ?? Infinity));
  await tx.insert(schema.customerLinks).values({
    tenantId: request.tenantId,
    requestId: request.id,
    tokenHash: sha256(token),
    expiresAt,
  });
  return { token, expiresAt };
}

export const hashToken = sha256;
