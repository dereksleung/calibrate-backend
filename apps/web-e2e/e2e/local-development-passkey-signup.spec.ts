import { expect, test } from "@playwright/test";

const emailVerificationPaths = new Set([
  "/api/v1/auth/email-verification",
  "/api/v1/auth/email-verification/verify",
]);

test("local development passkey signup creates a disposable account without email verification", async ({
  context,
  page,
}) => {
  const emailVerificationRequests: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (emailVerificationPaths.has(pathname)) {
      emailVerificationRequests.push(request.url());
    }
  });

  await context.credentials.install();
  await page.goto("signup-login");

  await page.getByRole("button", { name: "Authorize create passkey" }).click();
  await expect(page.getByRole("heading", { name: "Set up your passkey" })).toBeVisible();
  await expect(page.getByText(/Create a passkey for .+@example\.test to finish signing up\./)).toBeVisible();

  await page.getByRole("button", { name: "Create passkey" }).click();

  await expect(page.getByRole("heading", { name: "Daily Insights" })).toBeVisible();
  await expect(context.credentials.get({ rpId: "localhost" })).resolves.toHaveLength(1);

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Set up your passkey" })).toBeVisible();
  await page.getByRole("button", { name: "Create passkey" }).click();
  await expect(
    page.getByText(/Your enrollment authorization expired or can no longer be used\./),
  ).toBeVisible();

  expect(emailVerificationRequests).toEqual([]);
});
