import { purgeExpiredTenants } from "@clearloop/db";
import { NextResponse } from "next/server";
import { cronSecret } from "@/lib/server/config";
import { sweepAll } from "@/lib/server/outbox";

// GET /api/cron/sweep: retries due outbox rows across tenants and deletes expired sandboxes.
// Vercel Cron calls it with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const secret = cronSecret();
  const allowed = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : process.env.NODE_ENV !== "production";
  if (!allowed) return new Response("unauthorized", { status: 401 });
  const [sent, purged] = [await sweepAll(), await purgeExpiredTenants()];
  return NextResponse.json({ sent, purged });
}
