import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/loop";
import { getTranslator } from "@/i18n/server";

export async function NoSandbox({ expired = false }: { expired?: boolean }) {
  const { t } = await getTranslator();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo size={36} />
      <p className="max-w-sm text-fg-muted">{expired ? t("errors.noSession") : t("landing.ctaHint")}</p>
      <form action="/api/sandbox" method="post">
        <button type="submit" className="btn-primary px-5 py-3">
          {expired ? t("errors.startOver") : t("landing.cta")}
          <ArrowRight className="flip-rtl size-4" aria-hidden="true" />
        </button>
      </form>
    </main>
  );
}
