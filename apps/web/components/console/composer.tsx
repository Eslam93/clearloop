"use client";

import { AlertTriangle, Ban, Clock, RefreshCw, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/client";
import { blocks, checkMessage, type Finding } from "@/lib/domain/presend";
import { renderMessage, TEMPLATE_HAS_NOTE_SLOT, TEMPLATE_NEEDS_NOTE } from "@/lib/domain/templates";
import { noteRule } from "@/lib/domain/window";
import { ApiClientError, newIdempotencyKey } from "@/lib/view/api";
import { dateTime, duration, relative } from "@/lib/view/format";
import type { RequestView } from "@/lib/view/types";
import { useConsole } from "./context";

interface Conflict {
  by: string | null;
  from: string | null;
  to: string | null;
  at: string | null;
  type: string | null;
}

export function Composer({ request: current }: { request: RequestView }) {
  const { t, language } = useT();
  const { data, call, refresh, composerFocus } = useConsole();
  // The version the account manager is writing against. Live updates can move the request on;
  // once they have started, their message stays as written until they choose to review.
  const [snapshot, setSnapshot] = useState(current);
  const [engaged, setEngaged] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [duplicate, setDuplicate] = useState<{ by: string | null; at: string } | null>(null);
  const [expanded, setExpanded] = useState(false);
  // Pressing `n` opens the composer: a newer focus request than the last one handled.
  const [handledFocus, setHandledFocus] = useState(composerFocus);
  const working = engaged || note.trim().length > 0 || composerFocus > handledFocus;
  // Not started yet: simply follow the latest version.
  const r = working ? snapshot : current;
  const stale = working && current.version !== snapshot.version;
  // One key per intent to send: a double-click or a retry of the same send reuses it.
  const key = useRef(newIdempotencyKey());
  const sendButton = useRef<HTMLButtonElement>(null);

  const behind = current.debt.count > 0 || current.debt.customerAsked;
  const open = behind || expanded || composerFocus > handledFocus;
  const channel = r.customer.channel;
  const rule = noteRule(channel, r.template, r.customer.lastInboundAt, data.now);
  const amName = data.actor.role === "am" ? data.actor.name : r.customer.ownerName;

  const preview = useMemo(
    () =>
      renderMessage(r.template, r.customer.language, {
        contactName: r.customer.contactName,
        requestNumber: r.number,
        requestTitle: r.title,
        status: r.status,
        amName,
        eta: r.etaAt ? dateTime(r.etaAt, r.customer.language, r.customer.timeZone) : null,
        note: rule.allowed ? note : null,
      }),
    [r, amName, note, rule.allowed],
  );

  const findings: Finding[] = useMemo(
    () =>
      checkMessage({
        note: note || null,
        status: r.status,
        hasEta: r.etaAt !== null,
        internalNotes: r.internalNotes,
        engineerNames: data.engineerNames,
      }),
    [note, r.status, r.etaAt, r.internalNotes, data.engineerNames],
  );
  const blocked = blocks(findings);
  const warnings = findings.filter((f) => f.severity === "warn");
  const unacknowledged = warnings.filter((f) => !acknowledged.includes(f.id));
  const needsNote = TEMPLATE_NEEDS_NOTE[r.template] && !note.trim();

  // `n` in the list moves focus here.
  useEffect(() => {
    if (composerFocus > 0) requestAnimationFrame(() => sendButton.current?.focus());
  }, [composerFocus]);

  const latestChange = [...current.timeline].reverse().find((e) => e.type === "status_changed" || e.type === "eta_set");
  const shown: Conflict | null =
    conflict ??
    (stale && latestChange
      ? {
          by: latestChange.actorName,
          from: latestChange.from ?? null,
          to: latestChange.to ?? null,
          at: new Date(latestChange.at).toISOString(),
          type: latestChange.type,
        }
      : null);

  function review() {
    setSnapshot(current);
    setConflict(null);
    refresh();
  }

  async function send(options: { allowRepeat?: boolean } = {}) {
    setSending(true);
    setConflict(null);
    try {
      const result = await call<{ idempotent: boolean; duplicate_of?: { by: string | null; at: string }; channel: string }>(
        `/api/requests/${r.id}/notify`,
        {
          request_version: r.version,
          note: rule.allowed && note.trim() ? note.trim() : null,
          acknowledged: warnings.map((w) => w.id),
          allow_repeat: options.allowRepeat ?? false,
        },
        { idempotencyKey: key.current },
      );
      if (result.idempotent && result.duplicate_of) {
        setDuplicate(result.duplicate_of);
      } else {
        toast.success(t("composer.sent", { customer: r.customer.name, channel: t(`channel.${channel}`) }));
        setNote("");
        setAcknowledged([]);
        setDuplicate(null);
        setExpanded(false);
        setHandledFocus(composerFocus);
        setEngaged(false);
        setSnapshot(current);
      }
      key.current = newIdempotencyKey();
      refresh();
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "stale_request") {
        const current = (error.details as { current?: Record<string, string | null> } | undefined)?.current ?? {};
        setConflict({
          by: current.last_change_by ?? null,
          from: current.last_change_from ?? null,
          to: current.last_change_to ?? null,
          at: current.last_change_at ?? null,
          type: current.last_change_type ?? null,
        });
      } else if (error instanceof ApiClientError && error.code === "network") {
        toast.error(t("composer.errors.network"));
      } else {
        toast.error(t("composer.errors.generic"), { description: error instanceof Error ? error.message : undefined });
      }
    } finally {
      setSending(false);
    }
  }

  async function logInstead() {
    try {
      await call(`/api/requests/${r.id}/log`, { request_version: r.version, note: note.trim() || null });
      toast.success(t("composer.logged"));
      setNote("");
      refresh();
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "stale_request") refresh();
      else toast.error(t("composer.errors.generic"));
    }
  }

  if (!open) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3">
        <p className="text-sm text-fg-muted">{t("composer.upToDate", { customer: r.customer.name })}</p>
        <button type="button" className="btn-quiet" onClick={() => setExpanded(true)}>
          {t("composer.sendAgain")}
        </button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="composer-title"
      data-tour="composer"
      onFocusCapture={() => setEngaged(true)}
      className="rounded-xl border border-brand/25 bg-panel shadow-pane"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h3 id="composer-title" className="font-semibold">
          {t("composer.title", { customer: r.customer.name })}
        </h3>
        <span className="text-xs text-fg-subtle">
          {t("composer.via", {
            channel: t(`channel.${channel}`),
            language: r.customer.language === "ar" ? "العربية" : "English",
          })}
        </span>
      </header>

      <div className="space-y-3 p-4">
        {shown && (
          <div role="alert" className="rounded-lg border border-risk/40 bg-risk-soft p-3 text-sm text-risk-ink">
            <p className="flex items-center gap-2 font-semibold">
              <RefreshCw className="size-4" aria-hidden="true" />
              {t("composer.conflict.title")}
            </p>
            <p className="mt-1">
              {shown.type === "status_changed" && shown.from && shown.to
                ? t("composer.conflict.body", {
                    name: shown.by ?? "",
                    from: t(`status.${shown.from}`),
                    to: t(`status.${shown.to}`),
                    time: shown.at ? relative(Date.parse(shown.at), data.now, language) : "",
                  })
                : t("composer.conflict.bodyEta", {
                    name: shown.by ?? "",
                    time: shown.at ? relative(Date.parse(shown.at), data.now, language) : "",
                  })}
            </p>
            <button type="button" className="btn-ghost mt-2.5" onClick={review}>
              {t("composer.conflict.review")}
            </button>
          </div>
        )}

        {duplicate && (
          <div role="status" className="rounded-lg bg-sunken p-3 text-sm">
            <p className="flex items-center gap-2">
              <Clock className="size-4 text-fg-subtle" aria-hidden="true" />
              {t("composer.duplicate", {
                name: duplicate.by ?? "",
                time: relative(Date.parse(duplicate.at), data.now, language),
              })}
            </p>
            <button type="button" className="btn-quiet mt-1.5 px-0" onClick={() => send({ allowRepeat: true })}>
              {t("composer.sendAgain")}
            </button>
          </div>
        )}

        <div>
          <p className="kicker mb-1.5">{t("composer.preview", { contact: r.customer.contactName })}</p>
          <div
            dir="auto"
            lang={r.customer.language}
            className="whitespace-pre-line rounded-2xl rounded-ss-sm bg-brand-soft/70 px-3.5 py-3 text-sm leading-relaxed text-fg"
          >
            {preview}
          </div>
        </div>

        {rule.allowed ? (
          <div>
            <label htmlFor={`note-${r.id}`} className="kicker mb-1.5 block">
              {TEMPLATE_HAS_NOTE_SLOT[r.template] ? t("composer.noteFor") : t("composer.note")}
            </label>
            <textarea
              id={`note-${r.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !blocked && unacknowledged.length === 0 && !needsNote) void send();
              }}
              rows={2}
              dir="auto"
              placeholder={t("composer.notePlaceholder")}
              className="w-full resize-y rounded-lg border border-line-strong bg-panel px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <p className="mt-1 text-xs text-fg-subtle">
              {rule.windowClosesAt
                ? t("composer.windowOpen", { time: duration(rule.windowClosesAt - data.now, language) })
                : t("composer.noteHint")}
            </p>
          </div>
        ) : (
          <p className="rounded-lg bg-sunken px-3 py-2 text-xs leading-relaxed text-fg-muted">{t("composer.windowClosed")}</p>
        )}

        {findings.length > 0 && (
          <ul className="space-y-1.5" aria-live="polite">
            {findings.map((f) => (
              <li
                key={f.id}
                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                  f.severity === "block" ? "bg-breached-soft text-breached-ink" : "bg-risk-soft text-risk-ink"
                }`}
              >
                {f.severity === "block" ? <Ban className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                <span>{t(`composer.check.${f.id}`, { match: f.match, status: t(`status.${r.status}`) })}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {unacknowledged.length > 0 && !blocked ? (
            <button type="button" className="btn-primary" onClick={() => setAcknowledged(warnings.map((w) => w.id))}>
              <AlertTriangle className="size-4" aria-hidden="true" />
              {t("composer.sendAnyway")}
            </button>
          ) : (
            <button
              ref={sendButton}
              type="button"
              className="btn-primary"
              disabled={sending || blocked || needsNote}
              onClick={() => send()}
              data-testid="send-update"
            >
              <Send className="flip-rtl size-4" aria-hidden="true" />
              {sending ? t("composer.sending") : t("composer.send")}
              <span className="kbd ms-1 border-white/30 bg-white/15 text-current" aria-hidden="true">
                ⏎
              </span>
            </button>
          )}
          <button type="button" className="btn-quiet" onClick={logInstead} disabled={sending}>
            {t("composer.logInstead")}
          </button>
          {blocked && <span className="text-xs text-breached-ink">{t("composer.blocked")}</span>}
        </div>
      </div>
    </section>
  );
}
