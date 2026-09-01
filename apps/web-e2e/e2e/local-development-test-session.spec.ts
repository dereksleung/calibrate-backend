import { expect, test } from "@playwright/test";

test("starts a cookie-backed local test session without creating a passkey", async ({ context, page }) => {
  await context.credentials.install();
  await page.goto("signup-login");

  await expect(page.getByRole("heading", { name: "Local test session" })).toBeVisible();
  await page.getByRole("button", { name: "Start local test session" }).click();

  await expect(page.getByRole("heading", { name: "Seven-day nutrition" })).toBeVisible();
  await expect(context.credentials.get({ rpId: "localhost" })).resolves.toHaveLength(0);

  await page.goto("logs");
  await expect(page.getByRole("region", { name: "Selected day" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Breakfast" })).toBeVisible();
});
