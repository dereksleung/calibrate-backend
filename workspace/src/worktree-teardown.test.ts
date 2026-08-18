import { describe, expect, it } from "vitest";

import {
  parseDatabaseArgument,
  resolveTeardownDatabaseName,
} from "./worktree-teardown.js";

describe("worktree teardown database arguments", () => {
  it("accepts separated and equals-form database arguments", () => {
    expect(parseDatabaseArgument(["--database", "calibrate_wt_feature_a1b2c3d4"])).toEqual({
      kind: "provided",
      value: "calibrate_wt_feature_a1b2c3d4",
    });
    expect(parseDatabaseArgument(["--database=calibrate_wt_feature_a1b2c3d4"])).toEqual({
      kind: "provided",
      value: "calibrate_wt_feature_a1b2c3d4",
    });
  });

  it("refuses malformed database arguments instead of falling back", () => {
    expect(parseDatabaseArgument(["--database"])).toMatchObject({ kind: "invalid" });
    expect(parseDatabaseArgument(["--database="])).toMatchObject({ kind: "invalid" });
    expect(parseDatabaseArgument(["--database", "--other"])).toMatchObject({ kind: "invalid" });
  });

  it("does not read state when an explicit database is supplied", async () => {
    let stateRead = false;

    await expect(
      resolveTeardownDatabaseName(["--database=calibrate_wt_feature_a1b2c3d4"], async () => {
        stateRead = true;
        throw new Error("corrupt state");
      }),
    ).resolves.toBe("calibrate_wt_feature_a1b2c3d4");
    expect(stateRead).toBe(false);
  });

  it("uses state only when the database argument is omitted", async () => {
    await expect(
      resolveTeardownDatabaseName([], async () => ({
        dbName: "calibrate_wt_feature_a1b2c3d4",
        dbHost: "127.0.0.1",
        dbPort: 5433,
        bindings: {
          ports: { frontend: 3000, backend: 3001 },
          frontendUrl: "http://localhost:3000",
          backendUrl: "http://localhost:3001",
          viteApiBaseUrl: "http://localhost:3001/api/v1",
          corsOrigin: "http://localhost:3000",
          webauthnOrigin: "http://localhost:3000",
        },
      })),
    ).resolves.toBe("calibrate_wt_feature_a1b2c3d4");
  });
});
