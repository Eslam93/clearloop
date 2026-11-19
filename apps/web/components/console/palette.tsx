"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useT } from "@/i18n/client";
import type { ViewId } from "@/lib/view/types";
import { useConsole } from "./context";
import { RAIL_VIEWS } from "./rail";

interface Item {
  id: string;
  group: "actions" | "requests";
  label: string;
  hint?: string;
  run: () => void;
}

export function Palette({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { data, setView, select, setPanel } = useConsole();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const items = useMemo<Item[]>(() => {
    const actions: Item[] = [
      ...RAIL_VIEWS.map((v: ViewId) => ({
        id: `view:${v}`,
        group: "actions" as const,
        label: `${t("palette.goto")}: ${t(`views.${v}`)}`,
        run: () => setView(v),
      })),
      { id: "phones", group: "actions", label: t("demo.phones"), run: () => setPanel("phones") },
      { id: "demo", group: "actions", label: t("demo.title"), run: () => setPanel("demo") },
    ];
    const requests: Item[] = data.requests.map((r) => ({
      id: r.id,
      group: "requests",
      label: `#${r.number} ${r.title}`,
      hint: r.customer.name,
      run: () => select(r.id),
    }));
    const q = query.trim().toLowerCase();
    const all = [...actions, ...requests];
    return q ? all.filter((i) => `${i.label} ${i.hint ?? ""}`.toLowerCase().includes(q)).slice(0, 12) : actions;
  }, [query, data.requests, t, setView, setPanel, select]);

  function choose(item: Item | undefined) {
    if (!item) return;
    onClose();
    item.run();
  }

  return (
    <div className="flex flex-col" role="dialog" aria-label={t("shortcuts.palette")}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Search className="size-4 text-fg-subtle" aria-hidden="true" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(items[index]);
            }
          }}
          placeholder={t("palette.placeholder")}
          className="flex-1 bg-transparent text-sm outline-none"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={items[index] ? `palette-${items[index].id}` : undefined}
        />
      </div>
      <ul id="palette-list" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
        {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-fg-subtle">{t("palette.empty")}</li>}
        {items.map((item, i) => (
          <li
            key={item.id}
            id={`palette-${item.id}`}
            role="option"
            aria-selected={i === index}
            onMouseEnter={() => setIndex(i)}
            onClick={() => choose(item)}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${i === index ? "bg-brand-soft text-fg" : "text-fg-muted"}`}
          >
            <span className="truncate">{item.label}</span>
            {item.hint && <span className="shrink-0 text-xs text-fg-subtle">{item.hint}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ShortcutList() {
  const { t } = useT();
  const rows: Array<[string[], string]> = [
    [["J", "K"], t("shortcuts.move")],
    [["Enter"], t("shortcuts.open")],
    [["N"], t("shortcuts.notify")],
    [["1", "5"], t("shortcuts.view")],
    [["Ctrl", "K"], t("shortcuts.palette")],
    [["?"], t("shortcuts.help")],
  ];
  return (
    <div className="p-5">
      <h2 className="font-semibold">{t("shortcuts.title")}</h2>
      <dl className="mt-4 space-y-2.5">
        {rows.map(([keys, label]) => (
          <div key={label} className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="flex gap-1">
              {keys.map((k) => (
                <kbd key={k} className="kbd px-1.5 py-0.5 text-xs">
                  {k}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
