import "server-only";

// Sandboxes: every visitor gets an isolated tenant. Its own isolation is the proof of the tenancy
// model, and since a visitor only ever sees their own sandbox there is nothing to moderate.

import { createHash } from "node:crypto";
import { isRamadan, localDateOf, localToInstant, presetCalendar, workingIntervals } from "@clearloop/business-time";
import { eq, rateLimitHit, schema, type Tx, withTenant } from "@clearloop/db";
import { virtualNow } from "@/lib/domain/clock";
import { SANDBOX_TTL_MS, sessionSecret } from "./config";
import { ApiError } from "./http";
import { newTenantId, seedSandbox } from "./seed";
import { writeSession } from "./session";

const SANDBOXES_PER_HOUR = 20;
const RIYADH = "Asia/Riyadh";

/** A salted hash of the caller's address: enough to rate-limit, not enough to identify anyone. */
function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "local";
  return createHash("sha256").update(`${sessionSecret()}:${address}`).digest("hex").slice(0, 32);
}

export async function createSandbox(request: Request): Promise<string> {
  const allowed = await rateLimitHit(`sandbox:${clientKey(request)}`, 3600, SANDBOXES_PER_HOUR);
  if (!allowed) throw new ApiError("rate_limited", "Too many sandboxes from your network.");
  const tenantId = newTenantId();
  const expiresAt = new Date(Date.now() + SANDBOX_TTL_MS);
  await withTenant({ tenantId }, (tx) => seedSandbox(tx, tenantId, Date.now(), expiresAt));
  await writeSession({ tenantId, expiresAt: expiresAt.getTime() });
  return tenantId;
}

export type ClockJump = "plus_hour" | "next_morning" | "thursday_afternoon" | "after_weekend" | "ramadan";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Where a jump lands, in Riyadh time, strictly after `now`. */
export function jumpTarget(jump: ClockJump, now: number): number {
  const sa = presetCalendar("SA");
  const today = localDateOf(now, RIYADH);
  const firstAfter = (pick: (date: string) => number | null, days = 400) => {
    for (let i = 0; i <= days; i++) {
      const t = pick(addDays(today, i));
      if (t !== null && t > now) return t;
    }
    throw new Error(`no target for ${jump}`);
  };
  switch (jump) {
    case "plus_hour":
      return now + 3_600_000;
    case "next_morning":
      return firstAfter((date) => {
        const [first] = workingIntervals(sa, date);
        return first && date !== today ? first.start + 30 * 60_000 : null;
      });
    case "thursday_afternoon":
      return firstAfter((date) => (weekday(date) === 4 ? localToInstant(RIYADH, date, "16:30") : null));
    case "after_weekend":
      return firstAfter((date) => (weekday(date) === 0 ? localToInstant(RIYADH, date, "09:00") : null));
    case "ramadan":
      return firstAfter((date) =>
        isRamadan(date) && !isRamadan(addDays(date, -1)) ? localToInstant(RIYADH, date, "10:30") : null,
      );
  }
}

/** Moves the sandbox clock forward. Time never runs backwards, so events stay in order. */
export async function jumpClock(tx: Tx, jump: ClockJump): Promise<number> {
  const [tenant] = await tx.select().from(schema.tenants).limit(1);
  if (!tenant) throw new ApiError("no_session", "No sandbox.");
  const now = virtualNow(tenant.clockOffsetMs);
  const target = jumpTarget(jump, now);
  await tx
    .update(schema.tenants)
    .set({ clockOffsetMs: tenant.clockOffsetMs + (target - now) })
    .where(eq(schema.tenants.id, tenant.id));
  return target;
}
