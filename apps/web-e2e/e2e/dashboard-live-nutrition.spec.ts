import { expect, test } from "@playwright/test";

test("saving food updates the live dashboard nutrition cards", async ({ context, page }) => {
  await context.credentials.install();
  await page.goto("signup-login");

  await page.getByRole("button", { name: "Authorize create passkey" }).click();
  await expect(page.getByRole("heading", { name: "Set up your passkey" })).toBeVisible();

  await page.getByRole("button", { name: "Create passkey" }).click();
  await expect(page.getByRole("heading", { name: "Daily Insights" })).toBeVisible();

  await page.goto("logs");
  const breakfast = page.getByRole("region", { name: "Breakfast" });
  await breakfast.getByRole("button", { name: "No items logged yet" }).click();

  await expect(page.getByRole("heading", { name: "Recently logged" })).toBeVisible();
  await page.getByRole("button", { name: "Select Zero Sugar Oat" }).click();

  await expect(page.getByRole("heading", { name: "Add Food" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  await expect(breakfast.getByText("Zero Sugar Oat")).toBeVisible();
  await expect(breakfast.getByText("40", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Overview" }).click();

  const calories = page.getByRole("region", { name: "Calories" });
  await expect(calories).toContainText("40 calories eaten out of a 1,800 calorie limit");
  await expect(page.getByRole("table", { name: "Weekly calories eaten and limits" })).toContainText(
    "40 calories",
  );
});
