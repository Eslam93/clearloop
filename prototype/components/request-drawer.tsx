"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SlaBadge } from "@/components/sla-badge";
import { toast } from "sonner";
import type { NotificationRecord, RequestRecord } from "@/lib/data";
import { CURRENT_USER } from "@/lib/data";
import { useState } from "react";

interface RequestDrawerProps {
  request: RequestRecord | null;
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

const TIER_LABEL: Record<RequestRecord["customerTier"], string> = {
  standard: "Standard",
  pro: "Pro",
  vip: "VIP",
};

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RequestDrawer({
  request,
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
          actor_name: CURRENT_USER.name,
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
        actorName: CURRENT_USER.name,
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl"
      >
        <SheetHeader className="border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {request.id}
            </p>
            <SlaBadge request={request} />
          </div>
          <SheetTitle className="text-left text-base leading-snug">
            {request.title}
          </SheetTitle>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {request.customerName}
            </span>
            <span>·</span>
            <span>{TIER_LABEL[request.customerTier]}</span>
            <span>·</span>
            <span>{request.assignedTeam} team</span>
            <span>·</span>
            <span>Opened {formatRelative(request.createdAt)}</span>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Notify customer
              </h3>
              <span className="text-[11px] text-slate-400">
                via WhatsApp · template: status_update
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Send {request.customerName} the current status (
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {STATUS_LABEL[request.status]}
              </span>
              ) without leaving this screen.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button
                onClick={handleNotify}
                disabled={sending}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {sending ? "Sending…" : "Notify customer"}
              </Button>
              {request.notifications.length > 0 && (
                <span className="text-xs text-slate-500">
                  Last sent {formatRelative(
                    request.notifications[request.notifications.length - 1].sentAt
                  )}
                </span>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Status timeline
            </h3>
            <ol className="mt-3 space-y-3 border-l border-slate-200 pl-4 dark:border-slate-800">
              {reversedTimeline.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-400 ring-4 ring-white dark:bg-slate-500 dark:ring-slate-950" />
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {event.fromStatus
                      ? `${STATUS_LABEL[event.fromStatus]} → ${STATUS_LABEL[event.toStatus]}`
                      : `Created as ${STATUS_LABEL[event.toStatus]}`}
                  </p>
                  {event.note && (
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                      {event.note}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-500">
                    {event.actorName} · {formatRelative(event.at)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {request.notifications.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Notification history
              </h3>
              <ul className="mt-3 space-y-2">
                {request.notifications
                  .slice()
                  .reverse()
                  .map((n) => (
                    <li
                      key={n.id}
                      className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                    >
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {n.channel === "whatsapp" ? "WhatsApp" : "Email"} · sent at &ldquo;{STATUS_LABEL[n.statusAtSend]}&rdquo;
                      </span>
                      <span className="text-slate-500">
                        {n.actorName} · {formatRelative(n.sentAt)}
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
