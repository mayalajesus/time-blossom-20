import { expect, test } from "@playwright/test";

test.describe("public beta legal documents", () => {
  test("publishes the Terms of Use without requiring authentication", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { level: 1, name: "Termos de Uso" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("53.063.977/0001-14")).toBeVisible();
    await expect(page.getByText("mayalajesus@outsmarting.com.br")).toBeVisible();
  });

  test("publishes the Privacy Notice with LGPD rights and account deletion", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Aviso de Privacidade" })).toBeVisible(
      { timeout: 30_000 },
    );
    await expect(page.getByText("Seus direitos")).toBeVisible();
    await expect(page.getByText(/janela de 30 dias/i)).toBeVisible();
  });
});
