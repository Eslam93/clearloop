// Two languages, one of them right to left, with no i18n library: our own dictionaries, a `t` that
// fills `{name}` placeholders, plural forms by each language's rules, and lang/dir for the page.
//
// Ported from react-web-kit/i18n in the author's ToolKit and split for the App Router: this file is
// pure (server components call createTranslator directly), and client.tsx holds the React provider.
//
// The Arabic dictionary is typed as the same shape as the English one (Messages<typeof en>), so a
// missing key fails `tsc`. dictionaryProblems() finds the same at run time, plus placeholders that
// differ and values left in English, for a test.

export type Language = "en" | "ar";
export type Direction = "ltr" | "rtl";
export interface Dictionary {
  readonly [key: string]: string | Dictionary;
}
type PluralCategory = "zero" | "one" | "two" | "few" | "many";
export type PluralMessages = Readonly<{ other: string } & Partial<Record<PluralCategory, string>>>;
const PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many"]);

/** The same keys as `T`, each a string: the type of a translation of `T`. */
export type Messages<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends { readonly other: string }
      ? PluralMessages
      : Messages<T[K]>;
};
export type Vars = Record<string, string | number>;

export const LANGUAGES: Language[] = ["en", "ar"];
export const DIRECTIONS: Record<Language, Direction> = { en: "ltr", ar: "rtl" };
/** Latin digits and the Gregorian calendar in Arabic too; Hijri dates are shown on purpose. */
export const DATE_LOCALES: Record<Language, string> = { en: "en-GB", ar: "ar-u-nu-latn-ca-gregory" };
const PLACEHOLDER = /\{(\w+)\}/g;

export interface Translator {
  language: Language;
  dir: Direction;
  dateLocale: string;
  t(key: string, vars?: Vars): string;
  plural(key: string, count: number, vars?: Vars): string;
  has(key: string): boolean;
}

function lookup(dictionary: Dictionary, key: string): string | undefined {
  let node: string | Dictionary | undefined = dictionary;
  for (const part of key.split(".")) {
    if (node === undefined || typeof node === "string") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(PLACEHOLDER, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

export function createTranslator(
  dictionaries: Record<Language, Dictionary>,
  language: Language,
  fallback: Language = "en",
): Translator {
  const rules = new Intl.PluralRules(language);
  const own = dictionaries[language];
  const first = dictionaries[fallback];
  const t = (key: string, vars?: Vars) => fill(lookup(own, key) ?? lookup(first, key) ?? key, vars);
  return {
    language,
    dir: DIRECTIONS[language],
    dateLocale: DATE_LOCALES[language],
    t,
    plural(key, count, vars) {
      const form = rules.select(count);
      const exact = lookup(own, `${key}.${form}`) ?? lookup(own, `${key}.other`);
      return fill(exact ?? t(`${key}.other`), { count, ...vars });
    },
    has: (key) => lookup(own, key) !== undefined,
  };
}

function keysOf(dictionary: Dictionary, prefix = ""): Map<string, string> {
  const found = new Map<string, string>();
  for (const [name, value] of Object.entries(dictionary)) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (typeof value === "string") found.set(key, value);
    else for (const [inner, text] of keysOf(value, key)) found.set(inner, text);
  }
  return found;
}

function placeholders(text: string): Set<string> {
  return new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]!));
}

function samePlaceholders(reference: string, translated: string): boolean {
  const wanted = placeholders(reference);
  const given = placeholders(translated);
  return (
    [...given].every((n) => wanted.has(n)) && [...wanted].every((n) => n === "count" || given.has(n))
  );
}

/** Every problem of `other` against `reference`: missing, extra, empty, placeholders, untranslated. */
export function dictionaryProblems(
  reference: Dictionary,
  other: Dictionary,
  options: { looksTranslated?: (text: string) => boolean; same?: Iterable<string> } = {},
): string[] {
  const expected = keysOf(reference);
  const given = keysOf(other);
  const same = new Set(options.same ?? []);
  const problems: string[] = [];
  const pluralForm = (key: string, forms: Map<string, string>) => {
    const dot = key.lastIndexOf(".");
    return PLURAL_CATEGORIES.has(key.slice(dot + 1)) && forms.has(`${key.slice(0, dot)}.other`);
  };
  for (const [key, text] of expected) {
    const translated = given.get(key);
    if (translated === undefined && pluralForm(key, given)) continue;
    if (translated === undefined) problems.push(`missing: ${key}`);
    else if (!translated.trim()) problems.push(`empty: ${key}`);
    else if (!samePlaceholders(text, translated)) problems.push(`placeholders differ: ${key}`);
    else if (options.looksTranslated && !same.has(key) && !options.looksTranslated(translated))
      problems.push(`untranslated: ${key}`);
  }
  for (const key of given.keys()) {
    if (!expected.has(key) && !pluralForm(key, expected)) problems.push(`extra: ${key}`);
  }
  return problems;
}

export function hasArabic(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "ar";
}
