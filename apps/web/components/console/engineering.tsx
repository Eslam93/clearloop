"use client";

import { Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/client";
import { STATUSES, type Status } from "@/lib/domain/types";
import { api } from "@/lib/view/api";
import type { RequestView } from "@/lib/view/types";
import { useConsole } from "./context";

/**
 * Demo controls: act as the request's engineer. Engineers and leads have no workflow in ClearLoop
 * on purpose (v1's NOTES: don't build for users who haven't reported a problem); they exist here
 * only to drive the account manager's story.
 */
export function Engineering({ request: r }: { request: RequestView }) {
  const { t } = useT();
  const { data, refresh } = useConsole();
  const engineer = data.users.find((u) => u.role === "engineer" && u.team === r.team) ?? data.users.find((u) => u.role === "engineer");
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "customer">("customer");
  const [busy, setBusy] = useState(false);
  if (!engineer) return null;

  const as = engineer.handle;
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      refresh();
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="group rounded-xl border border-dashed border-line-strong bg-sunken/40" data-tour="engineering">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-fg-muted">
        <Wrench className="size-4" aria-hidden="true" />
        {t("engineering.title")}
        <span className="ms-auto text-xs font-normal text-fg-subtle">{engineer.name}</span>
      </summary>
      <div className="space-y-3 border-t border-dashed border-line-strong px-4 py-3">
        <p className="text-xs text-fg-subtle">{t("engineering.hint", { team: r.team })}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-fg-muted">{t("engineering.moveTo")}</span>
          {STATUSES.filter((s) => s !== r.status).map((to: Status) => (
            <button
              key={to}
              type="button"
              disabled={busy}
              className="rounded-full border border-line bg-panel px-2.5 py-1 text-xs font-medium hover:border-brand hover:text-brand-ink disabled:opacity-50"
              onClick={() => run(() => api(`/api/requests/${r.id}/status`, { persona: as, body: { to } }))}
            >
              {t(`status.${to}`)}
            </button>
          ))}
        </div>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            void run(() => api(`/api/requests/${r.id}/notes`, { persona: as, body: { text: text.trim(), visibility } })).then(() => setText(""));
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            dir="auto"
            placeholder={t("engineering.note")}
            className="w-full rounded-lg border border-line-strong bg-panel px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "internal" | "customer")}
              className="rounded-lg border border-line-strong bg-panel px-2 py-1.5 text-xs"
              aria-label={t("engineering.note")}
            >
              <option value="customer">{t("engineering.customer")}</option>
              <option value="internal">{t("engineering.internal")}</option>
            </select>
            <button type="submit" className="btn-ghost px-3 py-1.5 text-xs" disabled={busy || !text.trim()}>
              {t("engineering.add")}
            </button>
            <span className="ms-auto flex gap-1.5">
              <button
                type="button"
                className="btn-quiet px-2 py-1 text-xs"
                disabled={busy}
                onClick={() => {
                  const eta = new Date(data.now + 26 * 3_600_000);
                  void run(() => api(`/api/requests/${r.id}/eta`, { persona: as, body: { eta: eta.toISOString() } }));
                }}
              >
                {t("engineering.etaTomorrow")}
              </button>
              {r.etaAt && (
                <button
                  type="button"
                  className="btn-quiet px-2 py-1 text-xs"
                  disabled={busy}
                  onClick={() => run(() => api(`/api/requests/${r.id}/eta`, { persona: as, body: { eta: null } }))}
                >
                  {t("engineering.clearEta")}
                </button>
              )}
            </span>
          </div>
        </form>
      </div>
    </details>
  );
}
