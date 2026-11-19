"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useT } from "@/i18n/client";
import type { ConsoleData, ViewId } from "@/lib/view/types";
import { LoopGlyph } from "@/components/loop";
import { ConsoleProvider, useConsole } from "./context";
import { DemoDock } from "./demo-dock";
import { Detail } from "./detail";
import { DevicePanel } from "./device-panel";
import { Palette, ShortcutList } from "./palette";
import { Rail, RAIL_VIEWS, useViewCounts } from "./rail";
import { RequestList, useVisibleRequests } from "./request-list";
import { TopBar } from "./top-bar";

export function Console(props: { data: ConsoleData; persona: string; initialView: ViewId; initialRequest: number | null }) {
  return (
    <ConsoleProvider {...props}>
      <Shell />
    </ConsoleProvider>
  );
}

function subscribeWide(callback: () => void) {
  const query = window.matchMedia("(min-width: 1280px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const useWide = () =>
  useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 1280px)").matches, () => true);

function Shell() {
  const { t, dir } = useT();
  const { selected, select, panel, setPanel } = useConsole();
  const wide = useWide();
  useKeyboard();
  const end = dir === "rtl" ? "left" : "right";

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] overflow-hidden">
      <TopBar />
      <div className="grid min-h-0 lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)_minmax(420px,480px)]">
        <aside className="hidden min-h-0 overflow-y-auto border-e border-line bg-sunken/50 lg:block">
          <Rail />
        </aside>
        <main className="flex min-h-0 flex-col">
          <MobileViews />
          <RequestList />
        </main>
        <aside className="hidden min-h-0 overflow-y-auto border-s border-line bg-panel xl:block" aria-live="polite">
          {selected ? (
            <Detail request={selected} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
              <LoopGlyph state="open" size={40} />
              <p className="max-w-xs text-sm text-fg-muted">{t("detail.select")}</p>
            </div>
          )}
        </aside>
      </div>

      {/* Below 1280px the detail opens as a sheet. */}
      <Sheet open={!wide && !!selected} onOpenChange={(open) => !open && select(null)}>
        <SheetContent side={end} className="w-full overflow-y-auto p-0 sm:max-w-lg">
          <SheetTitle className="sr-only">{selected?.title ?? ""}</SheetTitle>
          {selected && <Detail request={selected} />}
        </SheetContent>
      </Sheet>

      <Sheet open={panel === "phones"} onOpenChange={(open) => !open && setPanel("none")}>
        <SheetContent side={end} className="w-full p-0 sm:max-w-md">
          <SheetTitle className="sr-only">{t("device.title")}</SheetTitle>
          <DevicePanel />
        </SheetContent>
      </Sheet>

      <Sheet open={panel === "demo"} onOpenChange={(open) => !open && setPanel("none")}>
        <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-full overflow-y-auto p-0 sm:max-w-sm">
          <SheetTitle className="sr-only">{t("demo.title")}</SheetTitle>
          <DemoDock />
        </SheetContent>
      </Sheet>

      <Sheet open={panel === "palette" || panel === "shortcuts"} onOpenChange={(open) => !open && setPanel("none")}>
        <SheetContent side="top" showCloseButton={false} className="mx-auto mt-[12vh] w-[min(560px,calc(100%-2rem))] rounded-xl border border-line p-0">
          <SheetTitle className="sr-only">{panel === "palette" ? t("shortcuts.palette") : t("shortcuts.title")}</SheetTitle>
          {panel === "palette" ? <Palette onClose={() => setPanel("none")} /> : <ShortcutList />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MobileViews() {
  const { t } = useT();
  const { view, setView } = useConsole();
  const counts = useViewCounts();
  return (
    <div className="flex gap-1.5 overflow-x-auto border-b border-line px-3 py-2 lg:hidden">
      {RAIL_VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          aria-pressed={view === v}
          className={`num shrink-0 rounded-full px-3 py-1 text-xs font-medium ${view === v ? "bg-brand text-brand-fg" : "bg-sunken text-fg-muted"}`}
        >
          {t(`views.${v}`)} · {counts[v]}
        </button>
      ))}
    </div>
  );
}

/** j/k to move, n to notify, 1-5 for views, Ctrl/Cmd+K for the palette, ? for help. */
function useKeyboard() {
  const { selectedId, select, setView, setPanel, panel, focusComposer } = useConsole();
  const rows = useVisibleRequests();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPanel(panel === "palette" ? "none" : "palette");
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (panel !== "none") return;
      const index = rows.findIndex((r) => r.id === selectedId);
      switch (event.key) {
        case "j":
        case "ArrowDown":
          event.preventDefault();
          select(rows[Math.min(index + 1, rows.length - 1)]?.id ?? null);
          break;
        case "k":
        case "ArrowUp":
          event.preventDefault();
          select(rows[Math.max(index - 1, 0)]?.id ?? null);
          break;
        case "Enter":
          if (!selectedId && rows[0]) select(rows[0].id);
          break;
        case "n":
          if (selectedId) {
            event.preventDefault();
            focusComposer();
          }
          break;
        case "Escape":
          select(null);
          break;
        case "?":
          setPanel("shortcuts");
          break;
        case "/":
          event.preventDefault();
          setPanel("palette");
          break;
        default:
          if (/^[1-5]$/.test(event.key)) setView(RAIL_VIEWS[Number(event.key) - 1]!);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, selectedId, select, setView, setPanel, panel, focusComposer]);
}
