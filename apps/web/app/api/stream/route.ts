import { and, asc, eq, gt, ne, schema, sql, withTenant } from "@clearloop/db";
import { resolveActor } from "@/lib/server/actor";
import { dispatchDue } from "@/lib/server/outbox";
import { readSession } from "@/lib/server/session";

// GET /api/stream: live changes for the session's tenant, as Server-Sent Events.
//
// - Reads the event log by id, resuming from Last-Event-ID after a reconnect.
// - Read barrier: only events whose transaction is older than every transaction still running
//   (xid < pg_snapshot_xmin). A slow transaction that took a lower id but commits later is
//   therefore never skipped.
// - Sends presence: who else has which request open.
// - Sweeps this tenant's due outbox rows while someone is watching (see docs/decisions on why the
//   sweeper rides on the stream in the demo).
// The connection closes after ~50s and the browser reconnects, which keeps it within serverless
// time limits.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const POLL_MS = 1_500;
const SWEEP_EVERY = 4; // polls
const LIFETIME_MS = 50_000;
const PRESENCE_WINDOW = "25 seconds";

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return new Response("no session", { status: 401 });
  const url = new URL(request.url);
  const resumeFrom = Number(request.headers.get("last-event-id") ?? url.searchParams.get("after"));
  const handle = url.searchParams.get("as");
  const tenantId = session.tenantId;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // the client went away
        }
      };
      let last = Number.isFinite(resumeFrom) && resumeFrom > 0 ? resumeFrom : null;
      let presenceKey = "";
      let polls = 0;
      const deadline = Date.now() + LIFETIME_MS;
      send("retry: 2000\n\n");

      while (!request.signal.aborted && Date.now() < deadline) {
        try {
          const { events, presence } = await withTenant({ tenantId }, async (tx) => {
            const actor = await resolveActor(tx, handle);
            if (last === null) {
              const result = await tx.execute(sql`select coalesce(max(id), 0) as id from request_events`);
              last = Number((result.rows[0] as { id: string | number }).id);
            }
            const events = await tx
              .select({ id: schema.requestEvents.id, type: schema.requestEvents.type, requestId: schema.requestEvents.requestId })
              .from(schema.requestEvents)
              .where(
                and(
                  gt(schema.requestEvents.id, last),
                  sql`${schema.requestEvents.xid} < pg_snapshot_xmin(pg_current_snapshot())`,
                ),
              )
              .orderBy(asc(schema.requestEvents.id))
              .limit(200);
            const presence = await tx
              .select({ handle: schema.users.handle, name: schema.users.name, requestId: schema.presence.requestId })
              .from(schema.presence)
              .innerJoin(schema.users, eq(schema.users.id, schema.presence.userId))
              .where(
                and(
                  ne(schema.presence.userId, actor.id),
                  sql`${schema.presence.seenAt} > now() - ${PRESENCE_WINDOW}::interval`,
                ),
              );
            return { events, presence };
          });

          if (events.length > 0) {
            last = events.at(-1)!.id;
            send(`id: ${last}\nevent: change\ndata: ${JSON.stringify({ requests: [...new Set(events.map((e) => e.requestId))], types: [...new Set(events.map((e) => e.type))] })}\n\n`);
          }
          const key = JSON.stringify(presence);
          if (key !== presenceKey) {
            presenceKey = key;
            send(`event: presence\ndata: ${key}\n\n`);
          }
          if (++polls % SWEEP_EVERY === 0) await dispatchDue(tenantId);
          if (polls % 10 === 0) send(": keep-alive\n\n");
        } catch (error) {
          console.error("stream poll failed", error);
        }
        await sleep(POLL_MS, request.signal);
      }
      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
