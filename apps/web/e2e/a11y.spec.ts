// Accessibility: no serious or critical axe violations (WCAG 2.x A and AA, plus best practice) on
// any page a visitor reaches. The rule set mirrors react-web-kit/axe_checks in the author's ToolKit.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { newSandbox, requestId, row, setLanguage } from "./helpers";

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

for (const lang of ["en", "ar"] as const) {
  test.describe(`accessibility (${lang})`, () => {
    test.beforeEach(async ({ context, baseURL }) => setLanguage(context, baseURL!, lang));

    test("landing page", async ({ page }) => {
      await page.goto("/");
      await audit(page);
    });

    test("console with a request open", async ({ page }) => {
      await newSandbox(page);
      await row(page, 1042).click();
      await audit(page);
    });

    test("insights", async ({ page }) => {
      await newSandbox(page);
      await page.goto("/app/insights");
      await audit(page);
    });

    test("customer status page", async ({ page }) => {
      await newSandbox(page);
      await page.request.post("/api/sandbox/settings", { data: { customer_portal_enabled: true } });
      const id = await requestId(page, 1042);
      const link = await page.request.post(`/api/requests/${id}/link`);
      const { url } = (await link.json()) as { url: string };
      await page.goto(url);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await audit(page);
    });
  });
}
