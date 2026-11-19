"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/i18n/client";
import { relative } from "@/lib/view/format";
import { inView, sortForView } from "@/lib/view/views";
import type { RequestView } from "@/lib/view/types";
import { LoopGlyph } from "@/components/loop";
import { DebtBadge, SlaChip, StatusLabel, TierTag } from "./badges";
import { useConsole } from "./context";

export function useVisibleRequests(): RequestView[] {
  const { data, view, ownerFilter } = useConsole();
  const mine = data.requests.filter((r) => ownerFilter === "all" || r.customer.ownerId === data.actor.id);
  return sortForView(view, mine.filter((r) => inView(view, r)), data.now);
}

export function RequestList() {
  const { t, plural } = useT();
  const { view, selectedId, select, presence } = useConsole();
  const rows = useVisibleRequests();
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the selected row in view when the keyboard moves it.
  useEffect(() => {
    if (!selectedId) return;
    listRef.current?.querySelector(`[data-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <section aria-labelledby="list-title" className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-5 pb-3 pt-5">
        <div>
          <h1 id="list-title" className="text-xl font-semibold tracking-tight">
            {t(`views.${view}`)}
          </h1>
          <p className="mt-0.5 text-sm text-fg-muted">{t(`views.hint.${view}`)}</p>
        </div>
        <p className="text-xs text-fg-subtle">
          {plural("list.requests", rows.length)} · {view === "owed" ? t("list.sort.owed") : t("list.sort.default")}
        </p>
      </header>
      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
          <LoopGlyph state="closed" size={36} />
          <p className="max-w-xs text-fg-muted">{t(`views.empty.${view}`)}</p>
        </div>
      ) : (
        <ul ref={listRef} role="listbox" aria-labelledby="list-title" className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {rows.map((r) => (
            <Row
              key={r.id}
              request={r}
              selected={r.id === selectedId}
              onSelect={() => select(r.id)}
              viewers={presence.filter((p) => p.requestId === r.id).map((p) => p.name)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({
  request: r,
  selected,
  onSelect,
  viewers,
}: {
  request: RequestView;
  selected: boolean;
  onSelect: () => void;
  viewers: string[];
}) {
  const { t, language } = useT();
  const { data } = useConsole();
  const lastTold = r.debt.lastToldAt;
  return (
    <li
      role="option"
      aria-selected={selected}
      data-id={r.id}
      tabIndex={-1}
      onClick={onSelect}
      className={`relative cursor-pointer px-5 py-3 transition-colors ${
        selected ? "bg-brand-soft/60 dark:bg-brand-soft/40" : "hover:bg-sunken/70"
      }`}
    >
      {selected && <span className="absolute inset-y-0 start-0 w-[3px] bg-brand" aria-hidden="true" />}
      <div className="flex items-center gap-2">
        <span className="truncate font-semibold">{r.customer.name}</span>
        <TierTag tier={r.customer.tier} />
        <span className="ms-auto flex items-center gap-1.5">
          <DebtBadge debt={r.debt} compact />
          {r.status !== "resolved" && <SlaChip sla={r.sla} calendar={r.customer.calendarName} />}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-sm">
        <span className="num shrink-0 font-mono text-xs text-fg-subtle">#{r.number}</span>
        <span className="truncate text-fg/85">{r.title}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-subtle">
        <StatusLabel status={r.status} />
        <span aria-hidden="true">·</span>
        <span>{lastTold ? t("list.lastTold", { time: relative(lastTold, data.now, language) }) : t("list.neverTold")}</span>
        {viewers.length > 0 && (
          <span className="ms-auto inline-flex items-center gap-1 text-brand-ink">
            <span className="size-1.5 animate-pulse rounded-full bg-brand" aria-hidden="true" />
            {t("presence.viewing", { names: viewers.join(", ") })}
          </span>
        )}
      </div>
    </li>
  );
}
