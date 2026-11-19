import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { Providers } from "@/components/providers";
import { DIRECTIONS } from "@/i18n/core";
import { currentLanguage, getTranslator } from "@/i18n/server";
import "./globals.css";

// One family drawn for both scripts: Latin glyphs come from Plex Sans, Arabic from Plex Sans Arabic.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: `ClearLoop · ${t("app.tagline")}`, template: "%s · ClearLoop" },
    description: t("landing.lead"),
    applicationName: "ClearLoop",
    openGraph: { type: "website", siteName: "ClearLoop", title: "ClearLoop", description: t("landing.lead") },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#141619" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const language = await currentLanguage();
  return (
    // lang and dir are rendered on the server, so Arabic never flashes left-to-right first.
    // suppressHydrationWarning: next-themes sets the theme class before React hydrates.
    <html
      lang={language}
      dir={DIRECTIONS[language]}
      className={`${plexSans.variable} ${plexArabic.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        <Providers language={language}>{children}</Providers>
      </body>
    </html>
  );
}
