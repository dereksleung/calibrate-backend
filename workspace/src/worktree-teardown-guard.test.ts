import { describe, expect, it } from "vitest";

import { explainTeardownRefusal, isTeardownDatabaseAllowed } from "./worktree-teardown-guard.js";

describe("worktree teardown guard", () => {
  const primaryDbName = "calibrate_dev";
  const currentWorktreeDbName = "calibrate_wt_feature_a1b2c3d4";

  it("allows only the current linked worktree database name", () => {
    expect(
      isTeardownDatabaseAllowed(currentWorktreeDbName, primaryDbName, currentWorktreeDbName),
    ).toBe(true);
    expect(
      isTeardownDatabaseAllowed("calibrate_wt_other_a1b2c3d4", primaryDbName, currentWorktreeDbName),
    ).toBe(false);
    expect(isTeardownDatabaseAllowed(currentWorktreeDbName, primaryDbName, undefined)).toBe(false);
    expect(isTeardownDatabaseAllowed("calibrate_dev", primaryDbName, currentWorktreeDbName)).toBe(false);
    expect(isTeardownDatabaseAllowed("postgres", primaryDbName, currentWorktreeDbName)).toBe(false);
    expect(isTeardownDatabaseAllowed("template0", primaryDbName, currentWorktreeDbName)).toBe(false);
    expect(isTeardownDatabaseAllowed("template1", primaryDbName, currentWorktreeDbName)).toBe(false);
  });

  it("explains why a database name cannot be dropped", () => {
    expect(explainTeardownRefusal(primaryDbName, primaryDbName, undefined)).toContain("primary checkout database");
    expect(explainTeardownRefusal("postgres", primaryDbName, undefined)).toContain("system database");
    expect(explainTeardownRefusal("some_other_db", primaryDbName, undefined)).toContain("calibrate_wt_*");
    expect(
      explainTeardownRefusal(
        "calibrate_wt_other_a1b2c3d4",
        primaryDbName,
        currentWorktreeDbName,
      ),
    ).toContain("this worktree");
  });
});
