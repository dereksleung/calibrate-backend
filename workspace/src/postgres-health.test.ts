import { describe, expect, it } from "vitest";

import { shouldStartComposePostgres, waitForPostgresReady } from "./postgres-health.js";

describe("postgres health", () => {
  it("skips compose up when the shared Postgres port is already accepting connections", () => {
    expect(shouldStartComposePostgres(true)).toBe(false);
    expect(shouldStartComposePostgres(false)).toBe(true);
  });

  it("retries the readiness probe until authenticated Postgres is ready", async () => {
    let attempts = 0;

    await waitForPostgresReady(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error("Postgres is still starting");
        }
      },
      { retryDelayMs: 0, timeoutMs: 100 },
    );

    expect(attempts).toBe(2);
  });
});
