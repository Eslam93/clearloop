// Visual pass: renders the main screens in both languages and both themes. Run on demand:
//   SCREENS=1 pnpm e2e screens
// Images go to test-results/screens (or SCREENS_OUT).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const out = process.env.SCREENS_OUT ?? join("test-results", "screens");
test.skip(!process.env.SCREENS, "screenshots run on demand");

async function newSandbox(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Open the live demo|افتح العرض الحي/ }).click();
  await page.waitForURL(/\/app/);
  await expect(page.getByRole("listbox")).toBeVisible();
}

async function setLanguage(page: Page, lang: "en" | "ar") {
  await page.context().addCookies([{ name: "cl_lang", value: lang, url: page.url() || "http://localhost:3000" }]);
}

for (const theme of ["light", "dark"] as const) {
  for (const lang of ["en", "ar"] as const) {
    test(`screens ${lang} ${theme}`, async ({ page }) => {
      mkdirSync(out, { recursive: true });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/");
      await setLanguage(page, lang);
      await page.goto("/");
      await page.screenshot({ path: join(out, `landing-${lang}-${theme}.png`), fullPage: true });

      await newSandbox(page);
      await page.getByRole("option").first().click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(out, `console-${lang}-${theme}.png`) });

      await page.getByRole("button", { name: /Customer phones|هواتف العملاء/ }).first().click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(out, `phones-${lang}-${theme}.png`) });
      await page.keyboard.press("Escape");

      await page.goto("/app/insights");
      await page.screenshot({ path: join(out, `insights-${lang}-${theme}.png`), fullPage: true });
    });
  }
}

test("screens mobile", async ({ browser }) => {
  mkdirSync(out, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await newSandbox(page);
  await page.screenshot({ path: join(out, "console-mobile.png") });
  await page.getByRole("option").first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, "detail-mobile.png") });
  await context.close();
});
