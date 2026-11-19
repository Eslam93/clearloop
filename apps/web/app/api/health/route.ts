import { tenantsWithDueOutbox } from "@clearloop/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/health: the app is up and can reach the database.
export async function GET() {
  try {
    await tenantsWithDueOutbox(1);
    return NextResponse.json({ ok: true, database: true });
  } catch {
    return NextResponse.json({ ok: false, database: false }, { status: 503 });
  }
}
