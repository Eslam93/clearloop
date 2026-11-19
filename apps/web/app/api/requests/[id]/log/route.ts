import { NextResponse } from "next/server";
import { LogUpdateBody } from "@/lib/api/contracts";
import { handle, parseBody } from "@/lib/server/http";
import { requestIdFrom } from "@/lib/server/ids";
import { logUpdate } from "@/lib/server/requests";
import { inSessionTenant } from "@/lib/server/route";

// POST /api/requests/{id}/log: the account manager told the customer another way. Records it so
// the customer's debt matches reality. Same 409 rule as notify.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = await requestIdFrom(params);
    const body = await parseBody(request, LogUpdateBody);
    const result = await inSessionTenant(request, (ctx) => logUpdate(ctx, id, body.request_version, body.note ?? null));
    return NextResponse.json(result);
  });
}
