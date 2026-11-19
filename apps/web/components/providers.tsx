"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import type { Language } from "@/i18n/core";
import { DIRECTIONS } from "@/i18n/core";
import { I18nProvider } from "@/i18n/client";

export function Providers({ language, children }: { language: Language; children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <I18nProvider language={language}>
        {children}
        <Toaster
          dir={DIRECTIONS[language]}
          position={language === "ar" ? "bottom-left" : "bottom-right"}
          toastOptions={{ className: "font-sans" }}
        />
      </I18nProvider>
    </ThemeProvider>
  );
}
