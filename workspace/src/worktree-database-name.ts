import { createHash } from "node:crypto";
import path from "node:path";

export const WORKTREE_DATABASE_PREFIX = "calibrate_wt_";

export function slugifyWorktreeDirectory(worktreeRoot: string): string {
  const slug = path
    .basename(worktreeRoot)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug.length > 0 ? slug.slice(0, 32) : "worktree";
}

export function hashWorktreePath(worktreeRoot: string): string {
  return createHash("sha256").update(path.resolve(worktreeRoot)).digest("hex").slice(0, 8);
}

export function deriveLinkedWorktreeDatabaseName(worktreeRoot: string): string {
  const slug = slugifyWorktreeDirectory(worktreeRoot);
  const hash = hashWorktreePath(worktreeRoot);
  return `${WORKTREE_DATABASE_PREFIX}${slug}_${hash}`;
}

export function isLinkedWorktreeDatabaseName(databaseName: string): boolean {
  return databaseName.startsWith(WORKTREE_DATABASE_PREFIX);
}
