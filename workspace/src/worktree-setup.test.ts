import { describe, expect, it } from "vitest";

import { createSetupEnvironment } from "./worktree-setup.js";

describe("worktree setup environment", () => {
  it("removes inherited E2E mode without mutating the parent environment", () => {
    const environment = {
      CALIBRATE_E2E: "1",
      DB_NAME: "calibrate_dev",
    };

    const setupEnvironment = createSetupEnvironment(environment);

    expect(setupEnvironment.CALIBRATE_E2E).toBeUndefined();
    expect(setupEnvironment.DB_NAME).toBe("calibrate_dev");
    expect(environment.CALIBRATE_E2E).toBe("1");
  });
});
