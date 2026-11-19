import { NextResponse } from "next/server";
import { ApiError } from "@/lib/server/http";
import { createSandbox } from "@/lib/server/sandbox";

// POST /api/sandbox: a fresh sandbox tenant for this visitor, then the console.
// A plain form post from the landing page, so it works without JavaScript.
export async function POST(request: Request) {
  try {
    await createSandbox(request);
    return NextResponse.redirect(new URL("/app", request.url), 303);
  } catch (error) {
    const code = error instanceof ApiError && error.code === "rate_limited" ? "rate_limited" : "failed";
    if (code === "failed") console.error(error);
    return NextResponse.redirect(new URL(`/?error=${code}`, request.url), 303);
  }
}
