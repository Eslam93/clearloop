import { ArrowRight, Check, Code2 } from "lucide-react";
import Link from "next/link";
import { LoopDiagram } from "@/components/landing/loop-diagram";
import { Logo } from "@/components/loop";
import { LanguageToggle, ThemeToggle } from "@/components/preferences";
import { getTranslator } from "@/i18n/server";

const REPO = "https://github.com/Eslam93/clearloop";

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { t } = await getTranslator();
  const { error } = await searchParams;
  const claims = ["bundle", "rls", "stale", "once", "business", "internal"] as const;
  const ideas = ["debt", "time", "loop"] as const;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-1">
          <a href={REPO} className="btn-quiet" rel="noreferrer">
            <Code2 className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t("landing.github")}</span>
          </a>
          <LanguageToggle />
          <ThemeToggle />
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-20 pt-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pt-16">
          <div>
            <p className="kicker">{t("landing.eyebrow")}</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.12] tracking-tight text-balance sm:text-5xl">
              {t("landing.title")}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-fg-muted">{t("landing.lead")}</p>
            {error === "rate_limited" && (
              <p role="alert" className="mt-6 rounded-lg bg-breached-soft px-4 py-3 text-sm text-breached-ink">
                {t("errors.rateLimited")}
              </p>
            )}
            {error === "expired" && (
              <p role="status" className="mt-6 rounded-lg bg-sunken px-4 py-3 text-sm text-fg-muted">
                {t("errors.noSession")}
              </p>
            )}
            <form action="/api/sandbox" method="post" className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
              <button type="submit" className="btn-primary px-5 py-3 text-base shadow-[0_10px_24px_-12px_var(--brand)]">
                {t("landing.cta")}
                <ArrowRight className="flip-rtl size-4" aria-hidden="true" />
              </button>
              <span className="text-sm text-fg-subtle">{t("landing.ctaHint")}</span>
            </form>
          </div>
          <LoopDiagram />
        </section>

        <section className="border-y border-line bg-panel/60">
          <div className="mx-auto grid w-full max-w-6xl gap-px px-5 py-14 md:grid-cols-3 md:gap-10">
            {ideas.map((idea, i) => (
              <article key={idea} className="py-4">
                <p className="num font-mono text-xs text-fg-subtle">0{i + 1}</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight">{t(`landing.ideas.${idea}.title`)}</h2>
                <p className="mt-2 leading-relaxed text-fg-muted">{t(`landing.ideas.${idea}.body`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t("landing.claimsTitle")}</h2>
            <p className="mt-3 leading-relaxed text-fg-muted">{t("landing.claimsLead")}</p>
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
            {claims.map((claim) => (
              <li key={claim} className="flex items-start gap-3 px-5 py-3.5">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok-ink">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                <span className="leading-relaxed">{t(`landing.claims.${claim}`)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 pb-20">
          <div className="rounded-2xl border border-line bg-sunken px-6 py-8 sm:px-10">
            <h2 className="text-xl font-semibold tracking-tight">{t("landing.originTitle")}</h2>
            <p className="mt-3 max-w-3xl leading-relaxed text-fg-muted">{t("landing.origin")}</p>
            <Link href={`${REPO}/blob/main/docs/case-study.md`} className="mt-5 inline-flex items-center gap-1.5 font-semibold text-brand-ink hover:underline">
              {t("landing.originLink")}
              <ArrowRight className="flip-rtl size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-fg-subtle">
          <Logo size={22} />
          <span>{t("landing.footer")}</span>
        </div>
      </footer>
    </div>
  );
}
