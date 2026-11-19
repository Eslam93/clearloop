import { eq, schema } from "@clearloop/db";
import { after, NextResponse } from "next/server";
import { SandboxSettingsBody } from "@/lib/api/contracts";
import { handle, parseBody } from "@/lib/server/http";
import { dispatchDue } from "@/lib/server/outbox";
import { inSessionTenant } from "@/lib/server/route";

// POST /api/sandbox/settings: demo switches (customer status page, phones offline).
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, SandboxSettingsBody);
    const tenantId = await inSessionTenant(request, async ({ tx, tenant }) => {
      await tx
        .update(schema.tenants)
        .set({
          customerPortalEnabled: body.customer_portal_enabled ?? tenant.customerPortalEnabled,
          deviceOffline: body.device_offline ?? tenant.deviceOffline,
        })
        .where(eq(schema.tenants.id, tenant.id));
      return tenant.id;
    });
    // Phones back online: anything waiting to retry can go now.
    if (body.device_offline === false) after(() => dispatchDue(tenantId).then(() => undefined));
    return NextResponse.json({ ok: true });
  });
}
