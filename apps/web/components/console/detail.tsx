"use client";

import { ArrowRight, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/client";
import { dateTime, relative } from "@/lib/view/format";
import type { RequestView } from "@/lib/view/types";
import { LoopGlyph } from "@/components/loop";
import { DebtBadge, SlaChip, StatusLabel, TierTag } from "./badges";
import { Composer } from "./composer";
import { useConsole } from "./context";
import { Engineering } from "./engineering";
import { Timeline } from "./timeline";

export function Detail({ request: r }: { request: RequestView }) {
  const { t, language } = useT();
  const { data, presence, call } = useConsole();
  const viewers = presence.filter((p) => p.requestId === r.id).map((p) => p.name);

  async function copyLink() {
    try {
      const { url } = await call<{ url: string }>(`/api/requests/${r.id}/link`);
      await navigator.clipboard.writeText(url);
      toast.success(t("link.copied"), { description: url });
    } catch {
      toast.error(t("link.disabled"));
    }
  }

  return (
    <article aria-labelledby="detail-title" className="flex flex-col gap-5 p-5">
      <header>
        <div className="flex flex-wrap items-center gap-2 pe-8 text-xs text-fg-subtle xl:pe-0">
          <span className="num font-mono">#{r.number}</span>
          <span aria-hidden="true">·</span>
          <span>{t(`priority.${r.priority}`)}</span>
          <span aria-hidden="true">·</span>
          <span>{t("detail.team", { team: r.team })}</span>
          <span className="ms-auto">{r.status !== "resolved" && <SlaChip sla={r.sla} calendar={r.customer.calendarName} />}</span>
        </div>
        <h2 id="detail-title" className="mt-2 text-lg font-semibold leading-snug tracking-tight text-balance">
          {r.title}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
          <span className="font-semibold text-fg">{r.customer.name}</span>
          <TierTag tier={r.customer.tier} />
          <span aria-hidden="true">·</span>
          <span>{t("detail.opened", { time: relative(r.openedAt, data.now, language) })}</span>
          <span aria-hidden="true">·</span>
          <span>{r.etaAt ? t("detail.eta", { date: dateTime(r.etaAt, language, r.customer.timeZone) }) : t("detail.noEta")}</span>
        </div>
        {viewers.length > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-ink" role="status">
            <span className="size-1.5 animate-pulse rounded-full bg-brand" aria-hidden="true" />
            {t("detail.viewing", { names: viewers.join(", ") })}
          </p>
        )}
      </header>

      <Knows request={r} />
      <Composer key={`${r.id}:${r.version}`} request={r} />
      <Engineering request={r} />
      <Timeline request={r} />

      {data.tenant.portalEnabled && (
        <button type="button" onClick={copyLink} className="btn-ghost self-start">
          <Link2 className="size-4" aria-hidden="true" />
          {t("link.copy")}
        </button>
      )}
    </article>
  );
}

/** What the customer believes, next to what is true. The heart of the product. */
function Knows({ request: r }: { request: RequestView }) {
  const { t, language } = useT();
  const { data } = useConsole();
  const behind = r.debt.count > 0 || r.debt.customerAsked;
  return (
    <section
      aria-label={`${t("debt.knows")} / ${t("debt.actually")}`}
      data-tour="knows"
      className={`rounded-xl border p-4 ${behind ? "border-debt/30 bg-debt-soft/50" : "border-line bg-sunken/60"}`}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <p className="kicker">{t("debt.knows")}</p>
          <p className="mt-1 text-[15px]">
            {r.debt.lastToldAt ? <StatusLabel status={r.debt.knownStatus} /> : <span className="text-fg-muted">{t("debt.nothingYet")}</span>}
          </p>
          {r.debt.lastToldAt && <p className="text-xs text-fg-subtle">{relative(r.debt.lastToldAt, data.now, language)}</p>}
        </div>
        <span className="flex flex-col items-center gap-1 text-fg-subtle" aria-hidden="true">
          <LoopGlyph state={!behind ? "closed" : r.debt.customerAsked ? "asked" : "open"} size={22} />
          <ArrowRight className="flip-rtl size-3.5" />
        </span>
        <div className="text-end">
          <p className="kicker">{t("debt.actually")}</p>
          <p className="mt-1 text-[15px]">
            <StatusLabel status={r.status} />
          </p>
          {r.debt.since && <p className="text-xs text-fg-subtle">{t("debt.since", { time: relative(r.debt.since, data.now, language) })}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DebtBadge debt={r.debt} />
        {r.debt.customerAsked && r.debt.askedAt && (
          <span className="text-xs font-medium text-breached-ink">{t("debt.askedAgo", { time: relative(r.debt.askedAt, data.now, language) })}</span>
        )}
      </div>
    </section>
  );
}
