import { schema, tenantForLink, withTenant, eq } from "@clearloop/db";
import type { Metadata } from "next";
import { LoopGlyph, Logo } from "@/components/loop";
import { createTranslator, DIRECTIONS, isLanguage } from "@/i18n/core";
import { dictionaries } from "@/i18n/dictionaries";
import { customerTimeline } from "@/lib/domain/redact";
import type { Status } from "@/lib/domain/types";
import { toDomainEvent } from "@/lib/server/events";
import { hashToken } from "@/lib/server/requests";
import { dateTime } from "@/lib/view/format";

// The customer status page, reached by a signed link. No login. Shows only what the redaction
// layer allows (lib/domain/redact.ts), in the customer's language unless they switch.
// Sandbox links are noindex, carry a demo banner, and die with the sandbox.

export const metadata: Metadata = { title: "Request status", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function StatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang } = await searchParams;
  const valid = /^[\w-]{20,64}$/.test(token);
  const tokenHash = hashToken(token);
  const tenantId = valid ? await tenantForLink(tokenHash) : null;

  const data = tenantId
    ? await withTenant({ tenantId }, async (tx) => {
        const [link] = await tx.select().from(schema.customerLinks).where(eq(schema.customerLinks.tokenHash, tokenHash));
        if (!link) return null;
        const [request] = await tx.select().from(schema.requests).where(eq(schema.requests.id, link.requestId));
        if (!request) return null;
        const [customer] = await tx.select().from(schema.customers).where(eq(schema.customers.id, request.customerId));
        const [owner] = customer ? await tx.select().from(schema.users).where(eq(schema.users.id, customer.ownerUserId)) : [];
        const [calendar] = customer
          ? await tx.select().from(schema.businessCalendars).where(eq(schema.businessCalendars.id, customer.calendarId))
          : [];
        const events = await tx.select().from(schema.requestEvents).where(eq(schema.requestEvents.requestId, request.id));
        return { request, customer, owner, calendar, events: events.map(toDomainEvent) };
      })
    : null;

  const language = isLanguage(lang) ? lang : (data?.customer?.preferredLanguage ?? "en");
  const { t } = createTranslator(dictionaries, language);
  const dir = DIRECTIONS[language];

  if (!data || !data.customer) {
    return (
      <main dir={dir} lang={language} className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <Logo size={32} />
        <h1 className="text-xl font-semibold">{t("statusPage.expired")}</h1>
        <p className="text-fg-muted">{t("statusPage.expiredHint")}</p>
      </main>
    );
  }

  const { request, customer, owner, calendar } = data;
  const zone = (calendar?.definition as { timeZone?: string } | undefined)?.timeZone ?? "UTC";
  const timeline = customerTimeline(data.events).reverse();
  const lastUpdate = timeline.find((e) => e.kind === "update");
  const other = language === "ar" ? "en" : "ar";

  return (
    <div dir={dir} lang={language} className="min-h-dvh">
      <p className="bg-risk-soft px-4 py-2 text-center text-xs text-risk-ink" role="note">
        {t("statusPage.demo")}
      </p>
      <main className="mx-auto w-full max-w-xl px-5 py-10">
        <div className="flex items-center justify-between">
          <Logo size={24} />
          <a href={`?lang=${other}`} className="btn-quiet text-xs" lang={other}>
            {other === "ar" ? "العربية" : "English"}
          </a>
        </div>

        <p className="kicker mt-10">{t("statusPage.for", { customer: customer.name })}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("statusPage.title", { number: request.number })}
        </h1>
        <p className="mt-1 text-fg-muted" dir="auto">
          {request.title}
        </p>

        <section className="pane mt-6 flex items-center gap-4 p-5">
          <LoopGlyph state={request.status === "resolved" ? "closed" : "open"} size={32} />
          <div>
            <p className="text-sm text-fg-muted">{t("statusPage.current")}</p>
            <p className="text-lg font-semibold">{t(`status.${request.status as Status}`)}</p>
            {request.etaAt && <p className="text-sm text-fg-muted">{t("statusPage.eta", { date: dateTime(request.etaAt.getTime(), language, zone) })}</p>}
            {lastUpdate && (
              <p className="text-xs text-fg-subtle">{t("statusPage.updated", { time: dateTime(lastUpdate.at, language, zone) })}</p>
            )}
          </div>
        </section>

        <section className="mt-8" aria-labelledby="history">
          <h2 id="history" className="kicker">
            {t("statusPage.history")}
          </h2>
          <ol className="mt-4 space-y-4 border-s border-line ps-5">
            {timeline.map((e, i) => (
              <li key={i} className="relative">
                <span className="absolute -start-[25px] top-1.5 size-2.5 rounded-full bg-brand ring-4 ring-bg" aria-hidden="true" />
                <p className="font-medium">
                  {e.kind === "created" && t("statusPage.events.created")}
                  {e.kind === "status" && t(`status.${e.to}`)}
                  {e.kind === "note" && t("statusPage.events.note")}
                  {e.kind === "update" && t("statusPage.events.update")}
                  {e.kind === "eta" && (e.eta ? t("statusPage.eta", { date: dateTime(e.eta, language, zone) }) : t("detail.events.eta_cleared"))}
                </p>
                {e.kind === "note" && (
                  <p className="mt-0.5 text-fg-muted" dir="auto">
                    {e.text}
                  </p>
                )}
                <p className="text-xs text-fg-subtle">{dateTime(e.at, language, zone)}</p>
              </li>
            ))}
          </ol>
        </section>

        {owner && <p className="mt-10 text-sm text-fg-muted">{t("statusPage.from", { am: owner.name })}</p>}
      </main>
    </div>
  );
}
