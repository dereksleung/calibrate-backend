import { expect, test } from "@playwright/test";

test("requires the E2E runtime environment", () => {
  expect(process.env.CALIBRATE_E2E).toBe("1");
});
