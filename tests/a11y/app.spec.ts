import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const route of ["/tracker", "/reports", "/settings"]) {
  test(`has no critical accessibility violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical, critical.map((violation) => violation.help).join("; ")).toEqual([]);
  });
}
