import { describe, expect, it } from "vitest";

import { explainTeardownRefusal, isTeardownDatabaseAllowed } from "./worktree-teardown-guard.js";

describe("worktree teardown guard", () => {
  const primaryDbName = "calibrate_dev";

  it("allows only linked worktree database names", () => {
    expect(isTeardownDatabaseAllowed("calibrate_wt_feature_a1b2c3d4", primaryDbName)).toBe(true);
    expect(isTeardownDatabaseAllowed("calibrate_dev", primaryDbName)).toBe(false);
    expect(isTeardownDatabaseAllowed("postgres", primaryDbName)).toBe(false);
    expect(isTeardownDatabaseAllowed("template0", primaryDbName)).toBe(false);
    expect(isTeardownDatabaseAllowed("template1", primaryDbName)).toBe(false);
  });

  it("explains why a database name cannot be dropped", () => {
    expect(explainTeardownRefusal(primaryDbName, primaryDbName)).toContain("primary checkout database");
    expect(explainTeardownRefusal("postgres", primaryDbName)).toContain("system database");
    expect(explainTeardownRefusal("some_other_db", primaryDbName)).toContain("calibrate_wt_*");
  });
});
