// Formatting for the browser and the server alike. Everything takes the clock (`now`) and the
// language explicitly, so a server render and its hydration produce the same text.

import { DATE_LOCALES, type Language } from "@/i18n/core";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relativeFormatters = new Map<Language, Intl.RelativeTimeFormat>();
function relativeFormatter(language: Language) {
  let f = relativeFormatters.get(language);
  if (!f) {
    f = new Intl.RelativeTimeFormat(language === "ar" ? "ar-u-nu-latn" : "en", { numeric: "auto", style: "short" });
    relativeFormatters.set(language, f);
  }
  return f;
}

/** "3h ago", "in 2 days", "قبل 3 ساعات". */
export function relative(at: number, now: number, language: Language): string {
  const diff = at - now;
  const abs = Math.abs(diff);
  const f = relativeFormatter(language);
  if (abs < MINUTE) return f.format(0, "minute");
  if (abs < HOUR) return f.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return f.format(Math.round(diff / HOUR), "hour");
  return f.format(Math.round(diff / DAY), "day");
}

/** A short duration: "1h 30m", "2d 4h", "45m". */
export function duration(ms: number, language: Language): string {
  const abs = Math.abs(ms);
  const days = Math.floor(abs / DAY);
  const hours = Math.floor((abs % DAY) / HOUR);
  const minutes = Math.floor((abs % HOUR) / MINUTE);
  const parts: Array<[number, "d" | "h" | "m"]> =
    days > 0 ? [[days, "d"], [hours, "h"]] : hours > 0 ? [[hours, "h"], [minutes, "m"]] : [[Math.max(minutes, abs > 0 ? 1 : 0), "m"]];
  const units = language === "ar" ? { d: "ي", h: "س", m: "د" } : { d: "d", h: "h", m: "m" };
  return parts
    .filter(([n], i) => n > 0 || i === 0)
    .map(([n, u]) => (language === "ar" ? `${n} ${units[u]}` : `${n}${units[u]}`))
    .join(language === "ar" ? " و" : " ");
}

export function dateTime(at: number, language: Language, timeZone?: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[language], {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
}

export function clockTime(at: number, language: Language, timeZone: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[language], {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
}

/** The Hijri date for a day, shown next to Gregorian in the sandbox clock. */
export function hijri(at: number, language: Language, timeZone: string): string {
  return new Intl.DateTimeFormat(`${language === "ar" ? "ar" : "en"}-u-ca-islamic-umalqura-nu-latn`, {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(at);
}

export function percent(value: number | null, language: Language): string {
  if (value === null) return "—";
  return new Intl.NumberFormat(language === "ar" ? "ar-u-nu-latn" : "en", { style: "percent", maximumFractionDigits: 0 }).format(value);
}
