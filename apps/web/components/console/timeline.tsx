"use client";

import { Check, CheckCheck, Circle, MessageCircleQuestion, Pencil, Send, Timer, TriangleAlert } from "lucide-react";
import { useT } from "@/i18n/client";
import { dateTime, relative } from "@/lib/view/format";
import type { RequestView, TimelineItem } from "@/lib/view/types";
import { InternalTag } from "./badges";
import { useConsole } from "./context";

const DELIVERY_ICON = { queued: Circle, sent: Check, delivered: CheckCheck, read: CheckCheck, failed: TriangleAlert, logged: Check };

export function Timeline({ request: r }: { request: RequestView }) {
  const { t, plural, language } = useT();
  const { data } = useConsole();
  const untold = new Set(r.debt.untoldIds);
  // Delivery receipts are shown on the update they belong to, not as their own rows.
  const items = r.timeline.filter((e) => e.type !== "delivery_updated").slice().reverse();
  const notification = (id?: string) => r.notifications.find((n) => n.id === id);

  return (
    <section aria-labelledby="timeline-title">
      <h3 id="timeline-title" className="kicker mb-3">
        {t("detail.timeline")}
      </h3>
      <ol className="relative space-y-3.5 border-s border-line ps-5">
        {items.map((e) => {
          const n = e.type === "update_sent" ? notification(e.notificationId) : undefined;
          const isUntold = untold.has(e.id);
          return (
            <li key={e.id} className="relative">
              <span
                className={`absolute -start-[27px] top-1 flex size-3.5 items-center justify-center rounded-full ring-4 ring-panel ${dotColor(e, isUntold)}`}
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <Icon item={e} />
                <span className="font-medium">{label(e, t)}</span>
                {e.visibility === "internal" && <InternalTag />}
                {isUntold && (
                  <span className="rounded bg-debt-soft px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-debt-ink ring-1 ring-inset ring-debt/30">
                    {t("debt.untold")}
                  </span>
                )}
              </div>
              {e.text && (e.type === "note_added" || e.type === "customer_pinged") && (
                <p
                  dir="auto"
                  className={`mt-1 text-sm leading-relaxed ${
                    e.type === "customer_pinged"
                      ? "rounded-lg bg-breached-soft/60 px-2.5 py-1.5 text-fg"
                      : e.visibility === "internal"
                        ? "text-fg-muted"
                        : "text-fg/85"
                  }`}
                >
                  {e.text}
                </p>
              )}
              {n && (
                <div className="mt-1.5 rounded-lg border border-line bg-sunken/60 p-2.5">
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-fg/80" dir="auto" lang={n.language}>
                    {n.body || "—"}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-subtle">
                    {(() => {
                      const Icon = DELIVERY_ICON[n.deliveryState];
                      return <Icon className={`size-3.5 ${n.deliveryState === "read" ? "text-brand" : n.deliveryState === "failed" ? "text-breached" : ""}`} aria-hidden="true" />;
                    })()}
                    {t(`delivery.${n.deliveryState}`)}
                    {n.deliveryState === "queued" && n.attempts > 0 && <span>· {plural("detail.attempts", n.attempts)}</span>}
                    {n.readAt && <span>· {relative(n.readAt, data.now, language)}</span>}
                  </p>
                </div>
              )}
              <p className="mt-0.5 text-xs text-fg-subtle">
                {[e.actorName, relative(e.at, data.now, language)].filter(Boolean).join(" · ")}
                <span className="sr-only"> ({dateTime(e.at, language, r.customer.timeZone)})</span>
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function dotColor(e: TimelineItem, untold: boolean): string {
  if (untold) return "bg-debt";
  if (e.type === "update_sent") return "bg-brand";
  if (e.type === "customer_pinged") return "bg-breached";
  if (e.visibility === "internal") return "bg-line-strong";
  return "bg-fg-subtle";
}

function Icon({ item }: { item: TimelineItem }) {
  const cls = "size-3.5 text-fg-subtle";
  switch (item.type) {
    case "update_sent":
      return <Send className="size-3.5 text-brand flip-rtl" aria-hidden="true" />;
    case "customer_pinged":
      return <MessageCircleQuestion className="size-3.5 text-breached" aria-hidden="true" />;
    case "note_added":
      return <Pencil className={cls} aria-hidden="true" />;
    case "eta_set":
      return <Timer className={cls} aria-hidden="true" />;
    default:
      return null;
  }
}

function label(e: TimelineItem, t: (key: string, vars?: Record<string, string | number>) => string): string {
  switch (e.type) {
    case "created":
      return t("detail.events.created");
    case "status_changed":
      return t("detail.events.status_changed", { from: t(`status.${e.from}`), to: t(`status.${e.to}`) });
    case "note_added":
      return t("detail.events.note_added");
    case "eta_set":
      return e.eta ? t("detail.events.eta_set", { eta: new Date(e.eta).toLocaleString() }) : t("detail.events.eta_cleared");
    case "customer_pinged":
      return t("debt.asked");
    case "update_sent":
      return e.channel === "out_of_band"
        ? t("detail.events.update_logged")
        : t("detail.events.update_sent", { channel: t(`channel.${e.channel}`) });
    default:
      return t("detail.events.delivery_updated", { state: t(`delivery.${e.state}`) });
  }
}
