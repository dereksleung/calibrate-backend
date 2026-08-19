import { execSync } from "node:child_process";
import path from "node:path";

export type GitWorktree = {
  path: string;
  bare: boolean;
};

export function parseGitWorktreeList(output: string): GitWorktree[] {
  const worktrees: GitWorktree[] = [];
  let current: GitWorktree | undefined;

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current) worktrees.push(current);
      current = { path: line.slice("worktree ".length).trim(), bare: false };
      continue;
    }

    if (line === "bare" && current) {
      current.bare = true;
    }
  }

  if (current) worktrees.push(current);
  return worktrees;
}

export function listGitWorktrees(worktreeRoot: string): GitWorktree[] {
  const output = execSync("git worktree list --porcelain", {
    cwd: worktreeRoot,
    encoding: "utf8",
  });
  return parseGitWorktreeList(output);
}

export function getPrimaryWorktreePathFromList(worktrees: GitWorktree[]): string {
  const primary = worktrees.find((worktree) => !worktree.bare);
  if (!primary) {
    throw new Error("Could not determine the primary git worktree.");
  }

  return path.resolve(primary.path);
}

export function getPrimaryWorktreePath(worktreeRoot: string): string {
  return getPrimaryWorktreePathFromList(listGitWorktrees(worktreeRoot));
}

export function isPrimaryWorktree(worktreeRoot: string): boolean {
  return path.resolve(worktreeRoot) === getPrimaryWorktreePath(worktreeRoot);
}
