"use client";

import { Clock, ExternalLink, FlaskConical, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/client";
import { clockTime, hijri, relative } from "@/lib/view/format";
import { useConsole } from "./context";

const JUMPS = ["plus_hour", "next_morning", "thursday_afternoon", "after_weekend", "ramadan"] as const;
const RIYADH = "Asia/Riyadh";

export function SandboxClock({ compact = false }: { compact?: boolean }) {
  const { language } = useT();
  const { data } = useConsole();
  return (
    <span className="num inline-flex items-center gap-1.5">
      <Clock className="size-3.5 text-fg-subtle" aria-hidden="true" />
      <span>{clockTime(data.now, language, RIYADH)}</span>
      {!compact && <span className="text-fg-subtle">· {hijri(data.now, language, RIYADH)}</span>}
    </span>
  );
}

export function DemoDock() {
  const { t, language } = useT();
  const { data, call, refresh, persona } = useConsole();
  const [busy, setBusy] = useState<string | null>(null);
  // Expiry is real time, unlike the sandbox clock. Read once per mount.
  const [realNow] = useState(() => Date.now());
  const otherAm = data.users.find((u) => u.role === "am" && u.handle !== persona);

  async function jump(to: (typeof JUMPS)[number]) {
    setBusy(to);
    try {
      await call("/api/sandbox/clock", { jump: to });
      refresh();
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(null);
    }
  }

  async function togglePortal() {
    await call("/api/sandbox/settings", { customer_portal_enabled: !data.tenant.portalEnabled }).catch(() => toast.error(t("errors.generic")));
    refresh();
  }

  const secondWindow = () => {
    const url = new URL(window.location.href);
    if (otherAm) url.searchParams.set("as", otherAm.handle);
    return url.toString();
  };

  return (
    <div className="flex flex-col gap-5 p-4">
      <header>
        <h2 className="flex items-center gap-2 font-semibold">
          <FlaskConical className="size-4" aria-hidden="true" />
          {t("demo.title")}
        </h2>
        <p className="mt-1 text-sm">
          <span className="font-medium">{data.tenant.name}</span>
        </p>
        {data.tenant.expiresAt && (
          <p className="text-xs text-fg-subtle">{t("demo.expires", { time: relative(data.tenant.expiresAt, realNow, language) })}</p>
        )}
      </header>

      <section>
        <h3 className="kicker">{t("demo.clock")}</h3>
        <p className="mt-1.5 text-sm">
          <SandboxClock />
        </p>
        <h3 className="kicker mt-4">{t("demo.timeMachine")}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {JUMPS.map((j) => (
            <button
              key={j}
              type="button"
              disabled={busy !== null}
              onClick={() => jump(j)}
              className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-medium hover:border-brand hover:text-brand-ink disabled:opacity-50"
            >
              {busy === j ? "…" : t(`demo.jump.${j}`)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="kicker">{t("demo.persona")}</h3>
        <p className="mt-1.5 text-sm">
          {data.actor.name} <span className="text-fg-subtle">· {t(`role.${data.actor.role}`)}</span>
        </p>
        {otherAm && (
          <a href={secondWindow()} target="_blank" rel="noreferrer" className="btn-ghost mt-2 text-xs">
            <ExternalLink className="flip-rtl size-3.5" aria-hidden="true" />
            {t("demo.secondWindow", { name: otherAm.name })}
          </a>
        )}
      </section>

      <section className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={data.tenant.portalEnabled} onChange={togglePortal} className="accent-[var(--brand)]" />
          {t("demo.portal")}
        </label>
      </section>

      <form action="/api/sandbox" method="post">
        <button type="submit" className="btn-ghost w-full text-xs">
          <RotateCcw className="size-3.5" aria-hidden="true" />
          {t("demo.reset")}
        </button>
      </form>
    </div>
  );
}
