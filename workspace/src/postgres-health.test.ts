import { describe, expect, it } from "vitest";

import { shouldStartComposePostgres } from "./postgres-health.js";

describe("postgres health", () => {
  it("skips compose up when the shared Postgres port is already accepting connections", () => {
    expect(shouldStartComposePostgres(true)).toBe(false);
    expect(shouldStartComposePostgres(false)).toBe(true);
  });
});
