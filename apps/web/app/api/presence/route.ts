import { schema, sql } from "@clearloop/db";
import { NextResponse } from "next/server";
import { PresenceBody } from "@/lib/api/contracts";
import { handle, parseBody } from "@/lib/server/http";
import { inSessionTenant } from "@/lib/server/route";

// POST /api/presence: "I have this request open", sent every few seconds while it is.
export async function POST(request: Request) {
  return handle(async () => {
    const { request_id } = await parseBody(request, PresenceBody);
    await inSessionTenant(request, async ({ tx, actor }) => {
      await tx
        .insert(schema.presence)
        .values({ tenantId: actor.tenantId, userId: actor.id, requestId: request_id, seenAt: sql`now()` })
        .onConflictDoUpdate({
          target: [schema.presence.tenantId, schema.presence.userId],
          set: { requestId: request_id, seenAt: sql`now()` },
        });
    });
    return NextResponse.json({ ok: true });
  });
}
