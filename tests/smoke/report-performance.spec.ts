import { expect, test } from "@playwright/test";
import { signInAs } from "../support/qa-auth";

test("keeps reports interactive while switching and reusing periods", async ({ page }) => {
  const reportRequests: Array<{ startDate: string; endDate: string }> = [];
  page.on("request", (request) => {
    if (!request.url().includes("/api/data") || request.method() !== "POST") return;
    try {
      const body = request.postDataJSON() as {
        operation?: string;
        startDate?: string;
        endDate?: string;
      };
      if (body.operation === "loadReportEntries" && body.startDate && body.endDate) {
        reportRequests.push({ startDate: body.startDate, endDate: body.endDate });
      }
    } catch {
      // Ignore non-JSON requests.
    }
  });

  await signInAs(page, "owner");
  await page.goto("/reports?preset=this-week");
  await expect(page.locator("#main-content")).toBeVisible();
  await expect.poll(() => reportRequests.length).toBeGreaterThan(0);

  const firstPeriod = reportRequests.at(-1)!;
  const nextRange = page.getByRole("button", { name: /Next range|Próximo/ }).first();
  await nextRange.click();
  await expect(page.locator("#main-content")).toBeVisible();
  await expect.poll(() => reportRequests.length).toBeGreaterThan(1);
  expect(reportRequests.at(-1)).not.toEqual(firstPeriod);

  const requestCountAfterNext = reportRequests.length;
  const previousRange = page.getByRole("button", { name: /Previous range|Anterior/ }).first();
  await previousRange.click();
  await expect(page.locator("#main-content")).toBeVisible();
  await page.waitForTimeout(500);
  expect(reportRequests.length).toBe(requestCountAfterNext);
});
