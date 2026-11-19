"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SlaBadge } from "@/components/sla-badge";
import { toast } from "sonner";
import type {
  CurrentUser,
  NotificationRecord,
  RequestRecord,
} from "@/lib/types";
import {
  formatAbsolute,
  formatRelative,
  hoursToSla,
  slaState,
} from "@/lib/sla";
import { useState } from "react";

interface RequestDrawerProps {
  request: RequestRecord | null;
  currentUser: CurrentUser;
  nowIso: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotified: (requestId: string, notification: NotificationRecord) => void;
}

const STATUS_LABEL: Record<RequestRecord["status"], string> = {
  new: "New",
  triage: "Triage",
  in_progress: "In progress",
  blocked: "Blocked",
  resolved: "Resolved",
};

const STATUS_DOT: Record<RequestRecord["status"], string> = {
  new: "bg-slate-400",
  triage: "bg-sky-500",
  in_progress: "bg-violet-500",
  blocked: "bg-rose-500",
  resolved: "bg-emerald-500",
};

const TIER_LABEL: Record<RequestRecord["customerTier"], string> = {
  standard: "Standard",
  pro: "Pro",
  vip: "VIP",
};

export function RequestDrawer({
  request,
  currentUser,
  nowIso,
  open,
  onOpenChange,
  onNotified,
}: RequestDrawerProps) {
  const [sending, setSending] = useState(false);

  if (!request) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl" />
      </Sheet>
    );
  }

  async function handleNotify() {
    if (!request) return;
    setSending(true);

    try {
      const res = await fetch(`/api/requests/${request.id}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "whatsapp",
          template: "status_update",
          request_version: request.version,
          status_at_send: request.status,
          actor_name: currentUser.name,
        }),
      });

      if (!res.ok) {
        toast.error("Could not send the update", {
          description: `Server returned ${res.status}. Try again.`,
        });
        return;
      }

      const body = (await res.json()) as {
        notification_id: string;
        sent_at: string;
        channel: "whatsapp" | "email";
        status_at_send: RequestRecord["status"];
        idempotent: boolean;
      };

      const notification: NotificationRecord = {
        id: body.notification_id,
        channel: body.channel,
        statusAtSend: body.status_at_send,
        actorName: currentUser.name,
        sentAt: body.sent_at,
      };

      onNotified(request.id, notification);

      toast.success("Status update sent via WhatsApp", {
        description: `${request.customerName} · "${STATUS_LABEL[request.status]}" pushed at ${formatAbsolute(notification.sentAt)}`,
        duration: 4500,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Network error";
      toast.error("Could not reach the server", { description: message });
    } finally {
      setSending(false);
    }
  }

  const reversedTimeline = [...request.timeline].reverse();
  const state = slaState(request.slaDueAt, nowIso);
  const hours = hoursToSla(request.slaDueAt, nowIso);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl"
      >
        <SheetHeader className="border-b border-black/[0.06] px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-kicker">{request.id}</span>
            <SlaBadge state={state} hours={hours} />
          </div>
          <SheetTitle className="mt-2 text-left text-lg font-semibold leading-snug tracking-tight">
            {request.title}
          </SheetTitle>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {request.customerName}
            </span>
            <span>·</span>
            <span>{TIER_LABEL[request.customerTier]}</span>
            <span>·</span>
            <span>{request.assignedTeam} team</span>
            <span>·</span>
            <span>Opened {formatRelative(request.createdAt, nowIso)}</span>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-7 px-5 pb-8 pt-5">
          {/* Notify — the hero action */}
          <section
            className="relative overflow-hidden rounded-2xl border p-5"
            style={{
              borderColor: "color-mix(in oklch, var(--brand) 18%, transparent)",
              backgroundImage:
                "linear-gradient(135deg, var(--brand-soft) 0%, oklch(0.985 0 0) 100%)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-kicker">Close the loop</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                via WhatsApp · status_update
              </span>
            </div>
            <p className="mt-2 text-sm text-foreground/85">
              Send <span className="font-semibold">{request.customerName}</span>{" "}
              the current status (
              <span className="font-semibold">
                {STATUS_LABEL[request.status]}
              </span>
              ) without leaving this screen.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleNotify}
                disabled={sending}
                className="brand-button inline-flex items-center gap-2"
              >
                {sending ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Sending…
                  </>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </svg>
                    Notify customer
                  </>
                )}
              </button>
              {request.notifications.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Last sent{" "}
                  {formatRelative(
                    request.notifications[request.notifications.length - 1]
                      .sentAt, nowIso)}
                </span>
              )}
            </div>
          </section>

          {/* Timeline */}
          <section>
            <div className="flex items-center justify-between">
              <span className="text-kicker">Status timeline</span>
              <span className="text-[10px] text-muted-foreground">
                {request.timeline.length} events · v{request.version}
              </span>
            </div>
            <ol className="mt-3 space-y-3.5 border-l border-black/[0.08] pl-5">
              {reversedTimeline.map((event, idx) => (
                <li key={event.id} className="relative">
                  <span
                    className={`absolute -left-[26px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${STATUS_DOT[event.toStatus]}`}
                  />
                  <p className="text-sm font-medium text-foreground">
                    {event.fromStatus
                      ? `${STATUS_LABEL[event.fromStatus]} → ${STATUS_LABEL[event.toStatus]}`
                      : `Created as ${STATUS_LABEL[event.toStatus]}`}
                    {idx === 0 && (
                      <span className="ml-2 rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Latest
                      </span>
                    )}
                  </p>
                  {event.note && (
                    <p className="mt-0.5 text-sm text-foreground/75">
                      {event.note}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {event.actorName} · {formatRelative(event.at, nowIso)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {request.notifications.length > 0 && (
            <section>
              <div className="flex items-center justify-between">
                <span className="text-kicker">Notification history</span>
                <span className="text-[10px] text-muted-foreground">
                  {request.notifications.length} sent
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {request.notifications
                  .slice()
                  .reverse()
                  .map((n) => (
                    <li
                      key={n.id}
                      className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white px-3.5 py-2.5 text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-md"
                          style={{
                            backgroundColor:
                              n.channel === "whatsapp"
                                ? "oklch(0.95 0.05 145)"
                                : "var(--brand-soft)",
                            color:
                              n.channel === "whatsapp"
                                ? "oklch(0.4 0.12 145)"
                                : "var(--brand-ink)",
                          }}
                        >
                          {n.channel === "whatsapp" ? (
                            <svg
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="h-3 w-3"
                              aria-hidden="true"
                            >
                              <path d="M20 4.04A10.46 10.46 0 0 0 12.06 1C6.5 1 2 5.5 2 11.07c0 1.78.47 3.5 1.34 5.04L2 22l6.1-1.32A10.06 10.06 0 0 0 12.05 21h.01c5.56 0 10.06-4.5 10.06-10.07 0-2.69-1.04-5.22-2.13-6.89zm-7.94 15.3h-.01a8.36 8.36 0 0 1-4.27-1.18l-.31-.18-3.62.78.79-3.52-.2-.32a8.34 8.34 0 0 1-1.27-4.43c0-4.61 3.75-8.36 8.37-8.36 2.24 0 4.34.87 5.92 2.45a8.33 8.33 0 0 1 2.45 5.92c0 4.61-3.75 8.36-8.36 8.36zm4.6-6.27c-.25-.13-1.48-.73-1.71-.82-.23-.08-.4-.13-.56.13s-.65.82-.8.99c-.14.16-.29.18-.54.06a6.91 6.91 0 0 1-2.04-1.26 7.66 7.66 0 0 1-1.42-1.76c-.15-.25-.02-.39.11-.51.11-.11.25-.29.38-.43.13-.15.17-.25.25-.41.08-.16.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43-.14 0-.31-.02-.48-.02-.16 0-.43.06-.66.31-.22.26-.86.84-.86 2.05 0 1.21.88 2.38 1.01 2.55.12.17 1.74 2.65 4.22 3.71.59.25 1.05.4 1.4.51.59.19 1.13.16 1.55.1.47-.07 1.48-.6 1.69-1.19.2-.59.2-1.09.14-1.19-.06-.1-.23-.16-.48-.29z" />
                            </svg>
                          ) : (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="h-3 w-3"
                              aria-hidden="true"
                            >
                              <rect x="3" y="5" width="18" height="14" rx="2" />
                              <path d="m3 7 9 6 9-6" />
                            </svg>
                          )}
                        </span>
                        <span className="font-medium text-foreground">
                          {n.channel === "whatsapp" ? "WhatsApp" : "Email"}
                        </span>
                        <span className="text-muted-foreground">
                          at &ldquo;{STATUS_LABEL[n.statusAtSend]}&rdquo;
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {n.actorName} · {formatRelative(n.sentAt, nowIso)}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
