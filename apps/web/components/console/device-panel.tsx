"use client";

import { Check, CheckCheck, Circle, Smartphone, TriangleAlert, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/client";
import { relative } from "@/lib/view/format";
import type { PhoneThread } from "@/lib/view/types";
import { useConsole } from "./context";

const STATE_ICON = { queued: Circle, sent: Check, delivered: CheckCheck, read: CheckCheck, failed: TriangleAlert, logged: Check };

/** The sandbox channel's other end: each customer's phone. */
export function DevicePanel() {
  const { t } = useT();
  const { data, call, refresh } = useConsole();
  const phones = data.phones.filter((p) => p.messages.length > 0 || p.customer.ownerId === data.actor.id);
  const [active, setActive] = useState<string>(() => {
    const firstOwed = data.requests.find((r) => r.debt.count > 0 && r.customer.ownerId === data.actor.id);
    return firstOwed?.customer.id ?? phones[0]?.customer.id ?? "";
  });
  const thread = phones.find((p) => p.customer.id === active) ?? phones[0];

  async function toggleOffline() {
    await call("/api/sandbox/settings", { device_offline: !data.tenant.deviceOffline }).catch(() => toast.error(t("errors.generic")));
    refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Smartphone className="size-4" aria-hidden="true" />
          {t("device.title")}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-fg-subtle">{t("device.hint")}</p>
        <label className="mt-2.5 flex items-center gap-2 text-xs font-medium text-fg-muted">
          <input type="checkbox" checked={data.tenant.deviceOffline} onChange={toggleOffline} className="accent-[var(--brand)]" />
          <WifiOff className="size-3.5" aria-hidden="true" />
          {t("demo.offline")}
        </label>
      </header>
      <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2" role="tablist">
        {phones.map((p) => (
          <button
            key={p.customer.id}
            type="button"
            role="tab"
            aria-selected={p.customer.id === thread?.customer.id}
            onClick={() => setActive(p.customer.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              p.customer.id === thread?.customer.id ? "bg-brand text-brand-fg" : "bg-sunken text-fg-muted hover:text-fg"
            }`}
          >
            {p.customer.name}
          </button>
        ))}
      </div>
      {thread && <Thread thread={thread} offline={data.tenant.deviceOffline} />}
    </div>
  );
}

function Thread({ thread, offline }: { thread: PhoneThread; offline: boolean }) {
  const { t, language } = useT();
  const { data, call, refresh } = useConsole();
  const [reply, setReply] = useState("");
  const recent = thread.messages.slice(-12);
  // Open at the newest message, like a phone does.
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [thread.customer.id, recent.length]);
  const quick = thread.customer.language === "ar" ? "هل من جديد؟" : "Any update?";
  async function read(id: string) {
    await call("/api/device/read", { notification_id: id }).catch(() => toast.error(t("errors.generic")));
    refresh();
  }
  async function send(text: string) {
    if (!text.trim()) return;
    await call("/api/device/reply", { customer_id: thread.customer.id, text: text.trim() }).catch(() => toast.error(t("errors.generic")));
    setReply("");
    refresh();
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 bg-sunken/70 px-4 py-2 text-xs text-fg-muted">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-ink">
          {thread.customer.contactName.replace(/^د\.\s*/, "").slice(0, 1)}
        </span>
        <span className="font-semibold text-fg">{thread.customer.contactName}</span>
        <span>· {thread.customer.name}</span>
        <span className="ms-auto">{t(`channel.${thread.customer.channel}`)}</span>
      </div>
      {offline && (
        <p className="bg-risk-soft px-4 py-2 text-xs text-risk-ink" role="status">
          {t("device.offline")}
        </p>
      )}
      <ol ref={listRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-sunken/30 px-3 py-3" aria-live="polite">
        {recent.length === 0 && <li className="py-8 text-center text-sm text-fg-subtle">{t("device.empty")}</li>}
        {recent.map((m) => {
          const out = m.direction === "out";
          const Icon = m.state ? STATE_ICON[m.state] : null;
          return (
            <li key={m.id} className={`flex ${out ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed shadow-sm ${
                  out ? "rounded-ss-sm bg-panel ring-1 ring-line" : "rounded-se-sm bg-brand-soft text-fg"
                }`}
              >
                <p className="whitespace-pre-line" dir="auto">
                  {m.text}
                </p>
                <p className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-fg-subtle">
                  {m.requestNumber && <span className="font-mono">#{m.requestNumber}</span>}
                  <span>{relative(m.at, data.now, language)}</span>
                  {Icon && <Icon className={`size-3.5 ${m.state === "read" ? "text-brand" : m.state === "failed" ? "text-breached" : ""}`} aria-label={t(`delivery.${m.state}`)} />}
                </p>
                {out && m.state === "delivered" && (
                  <button type="button" onClick={() => read(m.id)} className="mt-1 text-[11px] font-semibold text-brand-ink hover:underline">
                    {t("device.markRead")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <form
        className="flex items-center gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(reply);
        }}
      >
        <button type="button" className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs" onClick={() => send(quick)} lang={thread.customer.language}>
          {quick}
        </button>
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          dir="auto"
          placeholder={t("device.replyPlaceholder")}
          aria-label={t("device.reply", { contact: thread.customer.contactName })}
          className="min-w-0 flex-1 rounded-full border border-line-strong bg-panel px-3 py-1.5 text-sm outline-none focus:border-brand"
        />
        <button type="submit" className="btn-primary px-3 py-1.5 text-xs" disabled={!reply.trim()}>
          {t("device.send")}
        </button>
      </form>
    </div>
  );
}
