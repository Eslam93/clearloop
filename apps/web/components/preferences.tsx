"use client";

import { Languages, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSyncExternalStore, useTransition } from "react";
import { useT } from "@/i18n/client";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { language, t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = language === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      className={`btn-quiet ${className}`}
      disabled={pending}
      lang={next}
      onClick={() => {
        // A plain cookie read by the root layout, which renders <html lang dir> on the server.
        document.cookie = `cl_lang=${next}; path=/; max-age=31536000; samesite=lax`;
        start(() => router.refresh());
      }}
      title={t("common.language")}
    >
      <Languages className="size-4" aria-hidden="true" />
      {next === "ar" ? t("common.switchToArabic") : t("common.switchToEnglish")}
    </button>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useT();
  // The stored theme is only known in the browser; render the neutral icon on the server.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const order = ["system", "light", "dark"] as const;
  const current = mounted ? ((theme as (typeof order)[number]) ?? "system") : "system";
  const next = order[(order.indexOf(current) + 1) % order.length]!;
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : Monitor;
  const label = { system: t("common.themeSystem"), light: t("common.themeLight"), dark: t("common.themeDark") };
  return (
    <button
      type="button"
      className="btn-quiet"
      onClick={() => setTheme(next)}
      aria-label={`${t("common.theme")}: ${label[current]}`}
      title={`${t("common.theme")}: ${label[current]}`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
