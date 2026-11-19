import { withTenant } from "@clearloop/db";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { WeeklyChart } from "@/components/insights/weekly-chart";
import { Logo } from "@/components/loop";
import { NoSandbox } from "@/components/no-sandbox";
import { LanguageToggle, ThemeToggle } from "@/components/preferences";
import { getTranslator } from "@/i18n/server";
import type { LoopMetrics } from "@/lib/domain/metrics";
import { resolveActor } from "@/lib/server/actor";
import { loadConsole } from "@/lib/server/console";
import { computeInsights, type Group } from "@/lib/server/insights";
import { readSession } from "@/lib/server/session";
import { currentTenant } from "@/lib/server/tenant";
import { duration, percent, relative } from "@/lib/view/format";

export const metadata: Metadata = { title: "Insights", robots: { index: false } };

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const { as } = await searchParams;
  const session = await readSession();
  if (!session) return <NoSandbox />;
  const data = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    if (!(await currentTenant(tx))) return null;
    return loadConsole(tx, await resolveActor(tx, as));
  });
  if (!data) return <NoSandbox expired />;

  const { t, plural, language } = await getTranslator();
  const insights = computeInsights(data);
  const o = insights.overall;

  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center gap-3 border-b border-line bg-panel/80 px-4">
        <Link href={`/app?as=${data.actor.handle}`} className="btn-quiet">
          <ArrowLeft className="flip-rtl size-4" aria-hidden="true" />
          <Logo size={22} withName={false} />
          <span className="hidden sm:inline">{t("app.console")}</span>
        </Link>
        <div className="ms-auto flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("insights.title")}</h1>
        <p className="mt-1 text-sm text-fg-muted">{t("insights.period")}</p>
        <p className="mt-1 text-xs text-fg-subtle">{t("insights.simulated")}</p>

        <section className="mt-6 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]" aria-label={t("insights.title")}>
          <div className="pane p-5">
            <p className="text-sm font-medium text-fg-muted">{t("insights.askFirst")}</p>
            <p className="mt-2 text-5xl font-semibold tracking-tight">{percent(o.askFirstRate, language)}</p>
            <p className="mt-2 text-xs leading-relaxed text-fg-subtle">{t("insights.askFirstHint")}</p>
            <p className="mt-2 text-xs text-fg-subtle">{plural("insights.changes", o.decided)}</p>
          </div>
          <Tile label={t("insights.timeToTell")} value={o.medianTimeToTellMs === null ? "—" : duration(o.medianTimeToTellMs, language)} hint={t("insights.timeToTellHint")} />
          <Tile label={t("insights.behindNow")} value={String(insights.behindNow)} hint={t("views.hint.owed")} />
          <Tile
            label={t("insights.oldest")}
            value={insights.oldestUntold === null ? "—" : relative(insights.oldestUntold, insights.now, language)}
          />
        </section>

        <section className="pane mt-6 p-5" aria-labelledby="weekly-title">
          <h2 id="weekly-title" className="font-semibold">
            {t("insights.weekly")}
          </h2>
          <div className="mt-3">
            <WeeklyChart
              weeks={insights.weekly.map((w) => ({ start: w.start, end: w.end, rate: w.metrics.askFirstRate, decided: w.metrics.decided }))}
            />
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <MeterList title={t("insights.byAm")} groups={insights.byAm} label={(g) => g.label} />
          <MeterList title={t("insights.byTier")} groups={insights.byTier} label={(g) => t(`tier.${g.key}`)} />
        </div>
      </main>
    </div>
  );

  function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
      <div className="pane p-5">
        <p className="text-sm font-medium text-fg-muted">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-2 text-xs leading-relaxed text-fg-subtle">{hint}</p>}
      </div>
    );
  }

  /** A meter list: a name, a bar and a figure per row (one hue; the track is a lighter step of it). */
  function MeterList({ title, groups, label }: { title: string; groups: Group[]; label: (g: Group) => string }) {
    return (
      <section className="pane p-5" aria-label={title}>
        <h2 className="font-semibold">{title}</h2>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-xs text-fg-subtle">
              <th className="pb-2 text-start font-medium">{t("insights.columns.who")}</th>
              <th className="pb-2 text-start font-medium">{t("insights.columns.rate")}</th>
              <th className="pb-2 text-end font-medium">{t("insights.columns.tell")}</th>
              <th className="pb-2 text-end font-medium">{t("insights.columns.open")}</th>
            </tr>
          </thead>
          <tbody className="num">
            {groups.map((g) => (
              <tr key={g.key} className="border-t border-line">
                <td className="py-2.5 pe-3 font-medium">{label(g)}</td>
                <td className="py-2.5 pe-3">
                  <Meter metrics={g.metrics} />
                </td>
                <td className="py-2.5 text-end text-fg-muted">
                  {g.metrics.medianTimeToTellMs === null ? "—" : duration(g.metrics.medianTimeToTellMs, language)}
                </td>
                <td className="py-2.5 text-end text-fg-muted">{g.behindNow}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  function Meter({ metrics }: { metrics: LoopMetrics }) {
    const value = metrics.askFirstRate ?? 0;
    return (
      <span className="flex items-center gap-2">
        <span
          className="relative h-2 w-24 overflow-hidden rounded-full bg-chart-track"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value * 100)}
          aria-label={t("insights.askFirst")}
        >
          <span className="absolute inset-y-0 start-0 rounded-full bg-chart-debt" style={{ width: `${value * 100}%` }} />
        </span>
        <span className="text-fg">{percent(metrics.askFirstRate, language)}</span>
      </span>
    );
  }
}
