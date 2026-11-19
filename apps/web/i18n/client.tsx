"use client";

// The browser half of i18n: a provider and a hook. The language comes from the server (a cookie
// read in the root layout, which also renders <html lang dir>), so there is no left-to-right flash.

import { createContext, use, useMemo, type ReactNode } from "react";
import { createTranslator, type Language, type Translator } from "./core";
import { dictionaries } from "./dictionaries";

const I18nContext = createContext<Translator | null>(null);

export function I18nProvider({ language, children }: { language: Language; children: ReactNode }) {
  const translator = useMemo(() => createTranslator(dictionaries, language), [language]);
  return <I18nContext value={translator}>{children}</I18nContext>;
}

export function useT(): Translator {
  const translator = use(I18nContext);
  if (!translator) throw new Error("useT needs an I18nProvider");
  return translator;
}
