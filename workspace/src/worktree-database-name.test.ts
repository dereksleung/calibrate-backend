import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  deriveLinkedWorktreeDatabaseName,
  hashWorktreePath,
  isLinkedWorktreeDatabaseName,
  slugifyWorktreeDirectory,
} from "./worktree-database-name.js";

describe("worktree database naming", () => {
  it("derives a stable linked-worktree database name from the absolute path", () => {
    const worktreeRoot = "/tmp/feature-auth";

    expect(deriveLinkedWorktreeDatabaseName(worktreeRoot)).toBe(
      `calibrate_wt_feature_auth_${hashWorktreePath(worktreeRoot)}`,
    );
    expect(isLinkedWorktreeDatabaseName(deriveLinkedWorktreeDatabaseName(worktreeRoot))).toBe(true);
  });

  it("avoids collisions when two worktrees share the same folder basename", () => {
    const first = deriveLinkedWorktreeDatabaseName("/tmp/a/feature-auth");
    const second = deriveLinkedWorktreeDatabaseName("/tmp/b/feature-auth");

    expect(first).not.toBe(second);
    expect(slugifyWorktreeDirectory(path.resolve("/tmp/a/feature-auth"))).toBe("feature_auth");
    expect(slugifyWorktreeDirectory(path.resolve("/tmp/b/feature-auth"))).toBe("feature_auth");
  });
});
