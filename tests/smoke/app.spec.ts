import { expect, test } from "@playwright/test";

const routes = [
  "/tracker",
  "/projects",
  "/clients",
  "/team",
  "/reports",
  "/integrations",
  "/settings",
  "/search",
  "/workspaces",
];
const publicRoutes = ["/login", "/signup", "/forgot-password", "/auth/callback", "/invite/accept"];

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

test("all primary routes reload into the designed app shell", async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Cannot find module");
    await expect(page.locator("body")).not.toContainText("Unexpected token");
  }
});

test("authentication routes reload into a structured page", async ({ page }) => {
  for (const route of publicRoutes) {
    await page.goto(route);
    await expect(page.locator("main.auth-page"), route).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Cannot find module");
    await expect(page.locator("body")).not.toContainText("Unexpected token");
  }
});

test("settings preserves language and theme controls", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personal preferences" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Light" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Dark" })).toBeVisible();
  await page.getByRole("tab", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("time-blossom:account:v10")))
    .toContain('"theme":"dark"');
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("tab", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
});

test("profile menu is keyboard reachable from the sidebar", async ({ page }) => {
  await page.goto("/tracker");
  const profile = page.getByRole("button", { name: /Open account menu for/ });
  await profile.focus();
  await expect(profile).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: "Settings" })).toHaveCount(0);
});
