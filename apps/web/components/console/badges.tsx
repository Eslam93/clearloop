"use client";

import { Lock } from "lucide-react";
import { useT } from "@/i18n/client";
import type { SlaView } from "@/lib/domain/sla";
import type { Status, Tier } from "@/lib/domain/types";
import { duration } from "@/lib/view/format";
import type { DebtView } from "@/lib/view/types";
import { LoopGlyph } from "@/components/loop";

const SLA_STYLE: Record<SlaView["state"], string> = {
  breached: "bg-breached-soft text-breached-ink ring-breached/30",
  at_risk: "bg-risk-soft text-risk-ink ring-risk/35",
  on_track: "bg-ok-soft text-ok-ink ring-ok/25",
  paused: "bg-paused-soft text-paused-ink ring-paused/25",
  met: "bg-sunken text-fg-muted ring-line",
  missed: "bg-sunken text-fg-muted ring-line",
};

const SLA_DOT: Record<SlaView["state"], string> = {
  breached: "bg-breached",
  at_risk: "bg-risk animate-pulse",
  on_track: "bg-ok",
  paused: "bg-paused",
  met: "bg-fg-subtle",
  missed: "bg-fg-subtle",
};

export function SlaChip({ sla, calendar }: { sla: SlaView; calendar?: string }) {
  const { t, language } = useT();
  const time = duration(sla.remainingMs, language);
  const label = sla.state === "paused" || sla.state === "met" || sla.state === "missed" ? t(`sla.${sla.state}`) : t(`sla.${sla.state}`, { time });
  const title = [t(`sla.title.${sla.state}`), calendar ? t("sla.businessHours", { calendar }) : null].filter(Boolean).join(". ");
  return (
    <span
      title={title}
      className={`num inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${SLA_STYLE[sla.state]}`}
    >
      <span className={`size-1.5 rounded-full ${SLA_DOT[sla.state]}`} aria-hidden="true" />
      {label}
    </span>
  );
}

const STATUS_STYLE: Record<Status, string> = {
  new: "text-fg-muted",
  triage: "text-sky-700 dark:text-sky-300",
  in_progress: "text-brand-ink",
  blocked: "text-breached-ink",
  waiting_on_customer: "text-paused-ink",
  resolved: "text-ok-ink",
};

export function StatusLabel({ status }: { status: Status }) {
  const { t } = useT();
  return <span className={`whitespace-nowrap font-medium ${STATUS_STYLE[status]}`}>{t(`status.${status}`)}</span>;
}

export function TierTag({ tier }: { tier: Tier }) {
  const { t } = useT();
  if (tier === "standard") return null;
  return (
    <span
      className={`rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${
        tier === "vip" ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" : "bg-sunken text-fg-muted ring-1 ring-inset ring-line"
      }`}
    >
      {t(`tier.${tier}`)}
    </span>
  );
}

/** The communication signal: open loop (behind), red loop (they asked), closed loop (up to date). */
export function DebtBadge({ debt, compact = false }: { debt: DebtView; compact?: boolean }) {
  const { t, plural } = useT();
  if (debt.count === 0 && !debt.customerAsked) {
    return compact ? (
      <LoopGlyph state="closed" size={14} title={t("debt.upToDate")} />
    ) : (
      <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
        <LoopGlyph state="closed" size={14} />
        {t("debt.upToDate")}
      </span>
    );
  }
  const asked = debt.customerAsked;
  const text = asked && debt.count === 0 ? t("debt.asked") : plural("debt.behind", debt.count);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${
        asked ? "bg-breached-soft text-breached-ink ring-breached/30" : "bg-debt-soft text-debt-ink ring-debt/30"
      }`}
    >
      <LoopGlyph state={asked ? "asked" : "open"} size={13} />
      {text}
    </span>
  );
}

export function InternalTag() {
  const { t } = useT();
  return (
    <span className="inline-flex items-center gap-1 rounded bg-sunken px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-fg-subtle ring-1 ring-inset ring-line" title={t("detail.internalHint")}>
      <Lock className="size-2.5" aria-hidden="true" />
      {t("detail.internal")}
    </span>
  );
}
