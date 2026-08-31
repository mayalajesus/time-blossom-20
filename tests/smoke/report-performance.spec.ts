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

test("persists report filters across report views, reloads and route navigation", async ({
  page,
}) => {
  await signInAs(page, "owner");
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("time-blossom:report-filters:")) window.localStorage.removeItem(key);
    }
  });

  await page.goto("/reports?view=overview");
  await expect(
    page.getByRole("button", { name: /Billability filter|Filtro de Faturabilidade/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Open Billability|Open Faturabilidade/ }).click();
  await page.getByRole("menuitemradio", { name: /Internal|Interno/ }).click();
  await expect(page).toHaveURL(/billability=internal/);

  await page
    .getByRole("navigation", { name: /Report views|Visualizações do relatório/ })
    .getByRole("button", { name: /Detailed|Detalhado/ })
    .click();
  await expect(page).toHaveURL(/view=detailed/);
  await expect(page).toHaveURL(/billability=internal/);
  await expect(
    page.getByRole("button", { name: /Billability filter|Filtro de Faturabilidade/ }),
  ).toContainText(/Internal|Interno/);
  await page.getByRole("button", { name: /Choose columns|Escolher colunas/ }).click();
  await page.getByRole("checkbox", { name: /Description|Descrição/ }).check();
  await expect(page.getByRole("columnheader", { name: /Description|Descrição/ })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/view=detailed/);
  await expect(page).toHaveURL(/billability=internal/);
  await expect(
    page.getByRole("button", { name: /Billability filter|Filtro de Faturabilidade/ }),
  ).toContainText(/Internal|Interno/);
  await expect(page.getByRole("columnheader", { name: /Description|Descrição/ })).toBeVisible();

  await page.goto("/tracker");
  await expect(page.locator("#main-content")).toBeVisible();
  await page.goto("/reports?view=overview");
  await expect(page).toHaveURL(/view=overview/);
  await expect(page).toHaveURL(/billability=internal/);
  await expect(
    page.getByRole("button", { name: /Billability filter|Filtro de Faturabilidade/ }),
  ).toContainText(/Internal|Interno/);
  await page
    .getByRole("navigation", { name: /Report views|Visualizações do relatório/ })
    .getByRole("button", { name: /Detailed|Detalhado/ })
    .click();
  await expect(page.getByRole("columnheader", { name: /Description|Descrição/ })).toBeVisible();
});
