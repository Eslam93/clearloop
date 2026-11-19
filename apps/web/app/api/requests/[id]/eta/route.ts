import { NextResponse } from "next/server";
import { EtaBody } from "@/lib/api/contracts";
import { handle, parseBody } from "@/lib/server/http";
import { requestIdFrom } from "@/lib/server/ids";
import { setEta } from "@/lib/server/requests";
import { inSessionTenant } from "@/lib/server/route";

// POST /api/requests/{id}/eta: sets or clears the ETA. Changes the version, like a status change.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = await requestIdFrom(params);
    const body = await parseBody(request, EtaBody);
    await inSessionTenant(request, (ctx) => setEta(ctx, id, body.eta ? new Date(body.eta) : null));
    return NextResponse.json({ ok: true });
  });
}
