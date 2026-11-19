import { NextResponse } from "next/server";
import { ListQuery } from "@/lib/api/contracts";
import { loadConsole } from "@/lib/server/console";
import { inView, sortForView } from "@/lib/view/views";
import { ApiError, handle } from "@/lib/server/http";
import { inSessionTenant } from "@/lib/server/route";
import { toSummary } from "@/lib/server/serialize";

// GET /api/requests?view=owed&owner=me: part2-technical.md endpoint 1, in v2's shape.
// The tenant and user come from the session; nothing in the query can widen the scope.
export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const parsed = ListQuery.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) throw new ApiError("invalid_body", "Bad query.", parsed.error.issues);
    const { view, owner } = parsed.data;
    const data = await inSessionTenant(request, ({ tx, actor }) => loadConsole(tx, actor));
    const mine = (r: (typeof data.requests)[number]) => owner === "all" || r.customer.ownerId === data.actor.id;
    const items = sortForView(
      view === "all" ? "open" : view,
      data.requests.filter((r) => mine(r) && (view === "all" || inView(view, r))),
      data.now,
    );
    return NextResponse.json({
      items: items.map(toSummary),
      total: items.length,
      now: new Date(data.now).toISOString(),
    });
  });
}
