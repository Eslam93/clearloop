import { NextResponse } from "next/server";
import { NoteBody } from "@/lib/api/contracts";
import { handle, parseBody } from "@/lib/server/http";
import { requestIdFrom } from "@/lib/server/ids";
import { addNote } from "@/lib/server/requests";
import { inSessionTenant } from "@/lib/server/route";

// POST /api/requests/{id}/notes: an internal note, or one the customer can see.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = await requestIdFrom(params);
    const body = await parseBody(request, NoteBody);
    await inSessionTenant(request, (ctx) => addNote(ctx, id, body.text, body.visibility));
    return NextResponse.json({ ok: true });
  });
}
