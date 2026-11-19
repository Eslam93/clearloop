import { after, NextResponse } from "next/server";
import { NotifyBody } from "@/lib/api/contracts";
import { ApiError, handle, parseBody } from "@/lib/server/http";
import { dispatchDue } from "@/lib/server/outbox";
import { notify } from "@/lib/server/requests";
import { inSessionTenant } from "@/lib/server/route";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/requests/{id}/notify: part2-technical.md endpoint 2, with both of its edge cases built.
//   200: queued for sending, or `idempotent: true` when this replays an earlier send
//   409: stale_request; the request changed since the account manager saw it (fresh snapshot in details)
//   422: idempotency_conflict, blocked_by_check, note_not_allowed or note_required
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    if (!UUID.test(id)) throw new ApiError("not_found", "No such request.");
    const body = await parseBody(request, NotifyBody);
    const key = request.headers.get("idempotency-key");
    if (key !== null && !/^[\w-]{8,100}$/.test(key)) {
      throw new ApiError("invalid_body", "Idempotency-Key must be 8 to 100 letters, digits, _ or -.");
    }
    const { result, tenantId } = await inSessionTenant(request, async (ctx) => ({
      result: await notify(ctx, id, body, key),
      tenantId: ctx.tenantId,
    }));
    // Sent after the transaction has committed: the outbox row exists before any send is tried.
    if (result.dispatch) {
      const notificationId = result.dispatch;
      after(() => dispatchDue(tenantId, notificationId).then(() => undefined));
    }
    return NextResponse.json(result.body, { status: result.status });
  });
}
