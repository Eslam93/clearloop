import "server-only";

import { cookies } from "next/headers";
import { createTranslator, isLanguage, type Language, type Translator } from "./core";
import { dictionaries } from "./dictionaries";

export const LANGUAGE_COOKIE = "cl_lang";

export async function currentLanguage(): Promise<Language> {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  return isLanguage(value) ? value : "en";
}

export async function getTranslator(): Promise<Translator> {
  return createTranslator(dictionaries, await currentLanguage());
}
