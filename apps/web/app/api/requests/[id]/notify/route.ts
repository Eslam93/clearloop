import { NextRequest, NextResponse } from "next/server";

// In-memory notification log. Not a real database — it survives across requests
// within a single server process, but resets on restart. Sufficient to demonstrate
// the POST → persisted-record → response shape from part2-technical.md.
//
// In production this would be a Notification table; the idempotency + 409 logic
// would scope by (request_id, status_at_send, channel) and request_version.
const NOTIFICATION_LOG = new Map<
  string,
  Array<{
    notification_id: string;
    request_id: string;
    channel: string;
    status_at_send: string;
    actor_name: string;
    sent_at: string;
  }>
>();

interface NotifyBody {
  channel: "whatsapp" | "email";
  template: string;
  request_version: number;
  status_at_send: string;
  actor_name: string;
  custom_note?: string;
}

function isNotifyBody(value: unknown): value is NotifyBody {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.channel === "whatsapp" || v.channel === "email") &&
    typeof v.template === "string" &&
    typeof v.request_version === "number" &&
    typeof v.status_at_send === "string" &&
    typeof v.actor_name === "string"
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: requestId } = await context.params;
  const raw: unknown = await request.json().catch(() => null);

  if (!isNotifyBody(raw)) {
    return NextResponse.json(
      { error: "invalid_body" },
      { status: 400 }
    );
  }

  const notification = {
    notification_id: `ntf_${Date.now().toString(36)}`,
    request_id: requestId,
    channel: raw.channel,
    status_at_send: raw.status_at_send,
    actor_name: raw.actor_name,
    sent_at: new Date().toISOString(),
  };

  const existing = NOTIFICATION_LOG.get(requestId) ?? [];
  NOTIFICATION_LOG.set(requestId, [...existing, notification]);

  return NextResponse.json(
    {
      notification_id: notification.notification_id,
      sent_at: notification.sent_at,
      channel: notification.channel,
      status_at_send: notification.status_at_send,
      idempotent: false,
    },
    { status: 200 }
  );
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: requestId } = await context.params;
  const log = NOTIFICATION_LOG.get(requestId) ?? [];
  return NextResponse.json({ request_id: requestId, notifications: log });
}
