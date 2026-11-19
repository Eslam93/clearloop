import { NextResponse } from "next/server";
import { StatusBody } from "@/lib/api/contracts";
import { handle, parseBody } from "@/lib/server/http";
import { requestIdFrom } from "@/lib/server/ids";
import { changeStatus } from "@/lib/server/requests";
import { inSessionTenant } from "@/lib/server/route";

// POST /api/requests/{id}/status: an engineer moves the request (the demo's engineering controls).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = await requestIdFrom(params);
    const body = await parseBody(request, StatusBody);
    const updated = await inSessionTenant(request, (ctx) =>
      changeStatus(ctx, id, body.to, body.note ?? null, body.note_visibility),
    );
    return NextResponse.json({ id: updated.id, status: updated.status, version: updated.version });
  });
}
