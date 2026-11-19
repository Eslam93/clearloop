import { expect, type BrowserContext, type Page } from "@playwright/test";

/** A fresh sandbox tenant for this browser context, opened on the Owed updates view. */
export async function newSandbox(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /Open the live demo|افتح العرض الحي/ }).click();
  await page.waitForURL(/\/app/);
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.locator("html[data-hydrated]")).toHaveCount(1);
}

export async function setLanguage(context: BrowserContext, baseURL: string, lang: "en" | "ar") {
  await context.addCookies([{ name: "cl_lang", value: lang, url: baseURL }]);
}

/** The list row for a request number. */
export function row(page: Page, number: number) {
  return page.getByRole("option").filter({ hasText: `#${number}` });
}

export async function requestId(page: Page, number: number): Promise<string> {
  const response = await page.request.get("/api/requests?view=all&owner=all");
  const data = (await response.json()) as { items: Array<{ id: string; number: number }> };
  const found = data.items.find((i) => i.number === number);
  if (!found) throw new Error(`no request #${number}`);
  return found.id;
}
