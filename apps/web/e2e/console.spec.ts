import { expect, test } from "@playwright/test";
import { newSandbox, requestId, row, setLanguage } from "./helpers";

test.describe("the console", () => {
  test("telling a customer closes their loop", async ({ page }) => {
    await newSandbox(page);
    await row(page, 1042).click();
    const detail = page.getByRole("article");
    await expect(detail.getByText("2 updates behind")).toBeVisible();

    await detail.getByTestId("send-update").click();
    await expect(page.getByText("Sent to Nour Logistics via WhatsApp")).toBeVisible();

    // The customer is up to date, so the request leaves Owed updates.
    await expect(row(page, 1042)).toHaveCount(0);

    // The message reached the customer's phone, in Arabic, signed by the account manager.
    await page.getByRole("button", { name: "Customer phones" }).click();
    const phone = page.getByRole("dialog");
    await phone.getByRole("tab", { name: "Nour Logistics" }).click();
    await expect(phone.getByText("يعمل مهندسونا على طلبك الآن").last()).toBeVisible();
  });

  test("a change made in another window is caught before the customer is misinformed", async ({ context, page }) => {
    await newSandbox(page);
    await row(page, 1042).click();
    await page.keyboard.press("n"); // start an update: the composer keeps this version
    await expect(page.getByTestId("send-update")).toBeFocused();

    // A second window on the same sandbox: an engineer moves the request while it is open here.
    const other = await context.newPage();
    const id = await requestId(other, 1042);
    const moved = await other.request.post(`/api/requests/${id}/status`, {
      headers: { "x-clearloop-as": "khalid" },
      data: { to: "blocked" },
    });
    expect(moved.ok()).toBeTruthy();

    // Back to the first window. Its stream paused while it was hidden and replays what it missed.
    await page.bringToFront();
    // The live stream brings the change here while the update is still unsent.
    // Next.js has its own role="alert" route announcer; take ours by its text.
    const alert = page.getByRole("alert").filter({ hasText: "changed while you were looking" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Khalid Othman");
    await expect(alert).toContainText("In progress");
    await expect(alert).toContainText("Blocked");

    // Sending the message written for the old status is refused by the server (409).
    await page.getByTestId("send-update").click();
    await expect(alert).toBeVisible();
    await expect(page.getByText(/^Sent to /)).toHaveCount(0);

    // Reviewing adopts the new version; the preview (in Arabic, this customer's language) now says
    // the request is on hold.
    await alert.getByRole("button", { name: "Review the new message" }).click();
    await expect(page.getByText("الطلب متوقف مؤقتاً")).toBeVisible();
    await expect(alert).toHaveCount(0);
  });

  test("works without a mouse", async ({ page }) => {
    await newSandbox(page);
    await page.keyboard.press("1"); // Owed updates
    await page.keyboard.press("j"); // first request
    await expect(page.getByRole("listbox").getByRole("option", { selected: true })).toHaveCount(1);
    await page.keyboard.press("n"); // focus the send button
    await expect(page.getByTestId("send-update")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/^Sent to /)).toBeVisible();
  });

  test("Arabic mirrors the whole layout", async ({ context, page, baseURL }) => {
    await setLanguage(context, baseURL!, "ar");
    await newSandbox(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    const rail = await page.getByRole("navigation").first().boundingBox();
    const list = await page.getByRole("listbox").boundingBox();
    expect(rail!.x).toBeGreaterThan(list!.x);
    await expect(page.getByRole("heading", { name: "تحديثات مستحقة" })).toBeVisible();
  });
});

test.describe("tenant isolation over HTTP", () => {
  test("a visitor never sees another sandbox, and another sandbox's ids are not found", async ({ browser }) => {
    const a = await browser.newContext();
    const b = await browser.newContext();
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    await newSandbox(pageA);
    await newSandbox(pageB);

    const nameOf = async (page: typeof pageA) => (await page.getByText(/^Sandbox [0-9A-F]{4}$/).first().textContent())!;
    const sandboxA = await nameOf(pageA);
    const sandboxB = await nameOf(pageB);
    expect(sandboxA).not.toBe(sandboxB);
    expect(await pageA.content()).not.toContain(sandboxB);

    const idA = await requestId(pageA, 1042);
    const fromB = await pageB.request.get(`/api/requests/${idA}`);
    expect(fromB.status()).toBe(404);
    const notifyFromB = await pageB.request.post(`/api/requests/${idA}/notify`, { data: { request_version: 1 } });
    expect(notifyFromB.status()).toBe(404);

    await a.close();
    await b.close();
  });
});
