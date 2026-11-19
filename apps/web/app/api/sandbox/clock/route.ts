import { NextResponse } from "next/server";
import { ClockBody } from "@/lib/api/contracts";
import { handle, parseBody } from "@/lib/server/http";
import { inSessionTenant } from "@/lib/server/route";
import { jumpClock } from "@/lib/server/sandbox";

// POST /api/sandbox/clock: the time machine. Moves the sandbox's virtual clock forward.
export async function POST(request: Request) {
  return handle(async () => {
    const { jump } = await parseBody(request, ClockBody);
    const now = await inSessionTenant(request, ({ tx }) => jumpClock(tx, jump));
    return NextResponse.json({ now: new Date(now).toISOString() });
  });
}
