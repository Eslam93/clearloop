"use client";

import { BarChart3, CircleDashed, Clock3, Inbox, PauseCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { inView } from "@/lib/view/views";
import type { ViewId } from "@/lib/view/types";
import { useConsole } from "./context";

const ICONS: Record<ViewId, typeof Inbox> = {
  owed: CircleDashed,
  breaching: Clock3,
  waiting: PauseCircle,
  open: Inbox,
  resolved: CheckCircle2,
};

export const RAIL_VIEWS: ViewId[] = ["owed", "breaching", "waiting", "open", "resolved"];

export function useViewCounts() {
  const { data, ownerFilter } = useConsole();
  const visible = data.requests.filter((r) => ownerFilter === "all" || r.customer.ownerId === data.actor.id);
  return Object.fromEntries(RAIL_VIEWS.map((v) => [v, visible.filter((r) => inView(v, r)).length])) as Record<ViewId, number>;
}

export function Rail() {
  const { t } = useT();
  const { view, setView, ownerFilter, setOwnerFilter, data, persona } = useConsole();
  const counts = useViewCounts();
  return (
    <nav aria-label={t("views.open")} className="flex h-full flex-col gap-1 p-3">
      {data.actor.role === "am" && (
        <div className="mb-2 grid grid-cols-2 rounded-lg bg-sunken p-0.5 text-xs font-medium" role="radiogroup">
          {(["me", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={ownerFilter === value}
              onClick={() => setOwnerFilter(value)}
              className={`rounded-md px-2 py-1.5 transition-colors ${ownerFilter === value ? "bg-panel text-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}
            >
              {value === "me" ? t("views.mine") : t("views.everyone")}
            </button>
          ))}
        </div>
      )}
      {RAIL_VIEWS.map((id) => {
        const Icon = ICONS[id];
        const active = view === id;
        const highlight = id === "owed" && counts.owed > 0;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-current={active ? "page" : undefined}
            data-tour={id === "owed" ? "owed" : undefined}
            className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm transition-colors ${
              active ? "bg-panel font-semibold text-fg shadow-sm ring-1 ring-line" : "text-fg-muted hover:bg-sunken hover:text-fg"
            }`}
          >
            <Icon className={`size-4 shrink-0 ${highlight ? "text-debt" : ""}`} aria-hidden="true" />
            <span className="flex-1 truncate">{t(`views.${id}`)}</span>
            <span
              className={`num rounded-full px-1.5 text-xs font-semibold ${
                highlight ? "bg-debt text-white dark:text-[var(--bg)]" : "text-fg-subtle"
              }`}
            >
              {counts[id]}
            </span>
          </button>
        );
      })}
      <div className="my-3 h-px bg-line" />
      <Link
        href={`/app/insights?as=${persona}`}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-fg-muted transition-colors hover:bg-sunken hover:text-fg"
      >
        <BarChart3 className="size-4" aria-hidden="true" />
        {t("views.insights")}
      </Link>
    </nav>
  );
}
