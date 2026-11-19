import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { requestIdFrom } from "@/lib/server/ids";
import { createCustomerLink } from "@/lib/server/requests";
import { inSessionTenant } from "@/lib/server/route";

// POST /api/requests/{id}/link: a signed, expiring link to the customer status page.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = await requestIdFrom(params);
    const { token, expiresAt } = await inSessionTenant(request, ({ tx }) => createCustomerLink(tx, id));
    return NextResponse.json({ url: new URL(`/s/${token}`, request.url).toString(), expires_at: expiresAt.toISOString() });
  });
}
