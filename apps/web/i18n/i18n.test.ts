import { describe, expect, it } from "vitest";
import { ar } from "./ar";
import { createTranslator, dictionaryProblems, hasArabic } from "./core";
import { dictionaries } from "./dictionaries";
import { en } from "./en";

describe("dictionaries", () => {
  it("Arabic has every English key, the same placeholders, and Arabic text", () => {
    // Values that are the same in both languages on purpose.
    const same = [
      "common.switchToEnglish",
      "common.switchToArabic",
      // Only placeholders and an arrow.
      "detail.events.status_changed",
      "detail.events.delivery_updated",
    ];
    expect(dictionaryProblems(en, ar, { looksTranslated: hasArabic, same })).toEqual([]);
  });

  it("picks Arabic plural forms by the language's rules", () => {
    const t = createTranslator(dictionaries, "ar");
    expect(t.plural("debt.behind", 1)).toBe("فاته تحديث واحد");
    expect(t.plural("debt.behind", 2)).toBe("فاته تحديثان");
    expect(t.plural("debt.behind", 3)).toBe("فاتته 3 تحديثات");
    expect(t.plural("debt.behind", 11)).toBe("فاته 11 تحديثاً");
  });

  it("fills placeholders and falls back to English, then the key", () => {
    const t = createTranslator(dictionaries, "en");
    expect(t.t("composer.title", { customer: "Nour Logistics" })).toBe("Tell Nour Logistics");
    expect(t.t("no.such.key")).toBe("no.such.key");
  });
});
