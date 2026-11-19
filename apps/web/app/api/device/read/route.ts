import { eq, schema } from "@clearloop/db";
import { NextResponse } from "next/server";
import { DeviceReadBody } from "@/lib/api/contracts";
import { ApiError, handle, parseBody } from "@/lib/server/http";
import { inSessionTenant } from "@/lib/server/route";
import { handleDeliveryWebhook, signWebhook, statusPayload } from "@/lib/server/webhooks";

// POST /api/device/read: the customer reads a message on the simulated phone. The sandbox
// provider then sends a signed "read" receipt through the same handler a real webhook uses.
export async function POST(request: Request) {
  return handle(async () => {
    const { notification_id } = await parseBody(request, DeviceReadBody);
    const providerId = await inSessionTenant(request, async ({ tx }) => {
      const [n] = await tx
        .select({ providerMessageId: schema.notifications.providerMessageId })
        .from(schema.notifications)
        .where(eq(schema.notifications.id, notification_id));
      if (!n) throw new ApiError("not_found", "No such message.");
      return n.providerMessageId;
    });
    if (!providerId) throw new ApiError("invalid_body", "This message has not reached the phone yet.");
    const payload = statusPayload(providerId, "read");
    const applied = await handleDeliveryWebhook(payload, signWebhook(payload));
    return NextResponse.json({ applied });
  });
}
