"use client";

import { Command, FlaskConical, Keyboard, Smartphone } from "lucide-react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { Logo } from "@/components/loop";
import { LanguageToggle, ThemeToggle } from "@/components/preferences";
import { useConsole } from "./context";
import { SandboxClock } from "./demo-dock";

export function TopBar() {
  const { t } = useT();
  const { data, setPanel } = useConsole();
  const unreadPings = data.requests.filter((r) => r.debt.customerAsked).length;
  return (
    <header className="flex h-14 items-center gap-2 border-b border-line bg-panel/80 px-3 backdrop-blur sm:px-4">
      <Link href="/" className="rounded-lg p-1" aria-label="ClearLoop">
        <Logo size={26} withName={false} />
      </Link>
      <div className="hidden flex-col leading-tight sm:flex">
        <span className="text-sm font-semibold tracking-tight">ClearLoop</span>
        <span className="text-[11px] text-fg-subtle">{t("app.console")}</span>
      </div>

      <button
        type="button"
        onClick={() => setPanel("demo")}
        className="ms-2 hidden items-center gap-2 rounded-full border border-line bg-sunken px-3 py-1 text-xs text-fg-muted hover:text-fg md:inline-flex"
        title={t("demo.title")}
      >
        <FlaskConical className="size-3.5 text-brand" aria-hidden="true" />
        <span className="font-medium">{data.tenant.name}</span>
        <span className="text-line-strong" aria-hidden="true">
          |
        </span>
        <SandboxClock compact />
      </button>

      <div className="ms-auto flex items-center gap-0.5">
        <button type="button" className="btn-quiet hidden md:inline-flex" onClick={() => setPanel("palette")}>
          <Command className="size-4" aria-hidden="true" />
          <span className="sr-only">{t("shortcuts.palette")}</span>
          <span className="text-xs text-fg-subtle">Ctrl K</span>
        </button>
        <button type="button" className="btn-quiet relative" onClick={() => setPanel("phones")} data-tour="phones">
          <Smartphone className="size-4" aria-hidden="true" />
          {/* The name comes from the content, so it always contains what is visible. */}
          <span className="sr-only lg:not-sr-only">{t("demo.phones")}</span>
          {unreadPings > 0 && (
            <span
              className="num absolute -end-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-breached text-[10px] font-bold text-white"
              aria-hidden="true"
            >
              {unreadPings}
            </span>
          )}
        </button>
        <button type="button" className="btn-quiet md:hidden" onClick={() => setPanel("demo")} aria-label={t("demo.title")}>
          <FlaskConical className="size-4" aria-hidden="true" />
        </button>
        <button type="button" className="btn-quiet hidden sm:inline-flex" onClick={() => setPanel("shortcuts")} aria-label={t("shortcuts.title")}>
          <Keyboard className="size-4" aria-hidden="true" />
        </button>
        <LanguageToggle className="hidden sm:inline-flex" />
        <ThemeToggle />
        <span
          className="ms-1 hidden size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink sm:flex"
          title={`${t("common.signedAs")} ${data.actor.name}`}
        >
          {data.actor.name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")}
        </span>
      </div>
    </header>
  );
}
