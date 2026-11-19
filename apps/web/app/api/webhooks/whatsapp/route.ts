import { NextResponse } from "next/server";
import { whatsappConfig } from "@/lib/server/config";
import { handle } from "@/lib/server/http";
import { handleDeliveryWebhook } from "@/lib/server/webhooks";

// WhatsApp Cloud API webhook.
// GET: the subscription handshake (hub.mode, hub.verify_token, hub.challenge).
// POST: delivery receipts, verified with X-Hub-Signature-256 over the raw body before anything
// is parsed.

export async function GET(request: Request) {
  const url = new URL(request.url);
  const expected = whatsappConfig()?.verifyToken;
  if (
    expected &&
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === expected
  ) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(request: Request) {
  return handle(async () => {
    const raw = await request.text();
    const applied = await handleDeliveryWebhook(raw, request.headers.get("x-hub-signature-256"));
    return NextResponse.json({ applied });
  });
}
