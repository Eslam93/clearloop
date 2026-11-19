import "server-only";

// The demo session: a signed cookie naming the visitor's sandbox tenant. The tenant always comes
// from here, never from a request body or URL, so a visitor can only ever reach their own sandbox.
// Real auth would replace this file; the data layer would not change (docs/decisions).

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sessionSecret } from "./config";

export const SESSION_COOKIE = "cl_sandbox";

export interface Session {
  tenantId: string;
  expiresAt: number;
}

const b64 = (data: Buffer | string) => Buffer.from(data).toString("base64url");

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function encodeSession(session: Session): string {
  const payload = b64(JSON.stringify({ t: session.tenantId, e: session.expiresAt }));
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(value: string | undefined, now = Date.now()): Session | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      t?: unknown;
      e?: unknown;
    };
    if (typeof data.t !== "string" || typeof data.e !== "number" || data.e <= now) return null;
    return { tenantId: data.t, expiresAt: data.e };
  } catch {
    return null;
  }
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

export async function writeSession(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });
}
