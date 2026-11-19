import { NextResponse } from "next/server";
import { loadConsole } from "@/lib/server/console";
import { ApiError, handle } from "@/lib/server/http";
import { inSessionTenant } from "@/lib/server/route";
import { toDetail } from "@/lib/server/serialize";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/requests/{id}. Another tenant's id is "not found": 404, never 200 with an empty body,
// so the response says nothing about which ids exist elsewhere.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    if (!UUID.test(id)) throw new ApiError("not_found", "No such request.");
    const data = await inSessionTenant(request, ({ tx, actor }) => loadConsole(tx, actor));
    const found = data.requests.find((r) => r.id === id);
    if (!found) throw new ApiError("not_found", "No such request.");
    return NextResponse.json(toDetail(found));
  });
}
