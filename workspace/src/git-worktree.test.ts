import { describe, expect, it } from "vitest";

import { getPrimaryWorktreePathFromList, parseGitWorktreeList } from "./git-worktree.js";

describe("git worktree helpers", () => {
  it("parses porcelain worktree output and picks the first non-bare checkout as primary", () => {
    const worktrees = parseGitWorktreeList(`worktree /tmp/main
HEAD abc
branch refs/heads/main

worktree /tmp/feature
HEAD def
branch refs/heads/feature
`);

    expect(worktrees).toEqual([
      { path: "/tmp/main", bare: false },
      { path: "/tmp/feature", bare: false },
    ]);
    expect(getPrimaryWorktreePathFromList(worktrees)).toBe("/tmp/main");
  });
});
