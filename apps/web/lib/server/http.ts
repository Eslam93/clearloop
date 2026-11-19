import "server-only";

// One error envelope for every route (ported from fastapi-foundation/error_envelope in the
// author's ToolKit): { error: { code, message, details? } } with a matching HTTP status.

import { NextResponse } from "next/server";
import type { z } from "zod";

export type ErrorCode =
  | "invalid_body"
  | "not_found"
  | "no_session"
  | "stale_request"
  | "idempotency_conflict"
  | "rate_limited"
  | "blocked_by_check"
  | "note_not_allowed"
  | "note_required"
  | "forbidden"
  | "bad_signature"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  invalid_body: 400,
  not_found: 404,
  no_session: 401,
  stale_request: 409,
  idempotency_conflict: 422,
  rate_limited: 429,
  blocked_by_check: 422,
  note_not_allowed: 422,
  note_required: 422,
  forbidden: 403,
  bad_signature: 401,
  internal: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
  get status() {
    return STATUS[this.code];
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: { code: "internal", message: "Something went wrong on our side." } },
    { status: 500 },
  );
}

/** Runs a route body and turns any thrown ApiError (or bug) into the envelope. */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    return errorResponse(error);
  }
}

export async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("invalid_body", "The body is not valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("invalid_body", "The body does not match the schema.", parsed.error.issues);
  }
  return parsed.data;
}
