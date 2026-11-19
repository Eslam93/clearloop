import { and, desc, eq, ne, schema, sql } from "@clearloop/db";
import { NextResponse } from "next/server";
import { DeviceReplyBody } from "@/lib/api/contracts";
import { ApiError, handle, parseBody } from "@/lib/server/http";
import { inSessionTenant } from "@/lib/server/route";

// POST /api/device/reply: the customer writes back on the simulated phone ("any update?").
// It lands on their most recently discussed open request as a customer_pinged event, and opens
// WhatsApp's 24-hour window for free text.
export async function POST(request: Request) {
  return handle(async () => {
    const { customer_id, text } = await parseBody(request, DeviceReplyBody);
    await inSessionTenant(request, async ({ tx, now }) => {
      const open = await tx
        .select({ id: schema.requests.id, tenantId: schema.requests.tenantId })
        .from(schema.requests)
        .leftJoin(schema.notifications, eq(schema.notifications.requestId, schema.requests.id))
        .where(and(eq(schema.requests.customerId, customer_id), ne(schema.requests.status, "resolved")))
        // Postgres sorts nulls first under DESC; requests with no messages go last.
        .orderBy(sql`${schema.notifications.createdAt} desc nulls last`, desc(schema.requests.openedAt))
        .limit(1);
      const target = open[0];
      if (!target) throw new ApiError("not_found", "This customer has no open request.");
      await tx.insert(schema.requestEvents).values({
        tenantId: target.tenantId,
        requestId: target.id,
        type: "customer_pinged",
        visibility: "customer",
        occurredAt: new Date(now),
        data: { text },
      });
      await tx
        .update(schema.customers)
        .set({ lastInboundAt: new Date(now) })
        .where(eq(schema.customers.id, customer_id));
    });
    return NextResponse.json({ ok: true });
  });
}
