// Pure time helpers. Every function takes `nowIso` explicitly, so the server
// render and the browser hydration compute the same strings from one clock.

import type { RequestRecord, SlaState } from "@/lib/types";

const HOUR_MS = 60 * 60 * 1000;

export function hoursToSla(slaDueAtIso: string, nowIso: string): number {
  return (new Date(slaDueAtIso).getTime() - new Date(nowIso).getTime()) / HOUR_MS;
}

export function slaState(slaDueAtIso: string, nowIso: string): SlaState {
  const h = hoursToSla(slaDueAtIso, nowIso);
  if (h <= 0) return "breached";
  if (h <= 4) return "at_risk";
  return "healthy";
}

export function lastNotifiedAt(req: RequestRecord): string | null {
  if (req.notifications.length === 0) return null;
  return req.notifications
    .map((n) => n.sentAt)
    .sort()
    .at(-1)!;
}

export function formatRelative(iso: string, nowIso: string): string {
  const ms = new Date(nowIso).getTime() - new Date(iso).getTime();
  if (ms < 60 * 1000) return "just now";
  const hours = ms / HOUR_MS;
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// The demo's account manager works in the Gulf. Pinning the zone keeps the
// server render (UTC on Vercel) and the browser render identical.
const DISPLAY_ZONE = "Asia/Dubai";

export function formatDateLabel(nowIso: string): string {
  return new Date(nowIso).toLocaleDateString("en-GB", {
    timeZone: DISPLAY_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: DISPLAY_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
