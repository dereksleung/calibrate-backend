import type { DevBindings } from "@calibrate/dev-bindings";
import { randomUUID } from "node:crypto";
import { access, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const WORKTREE_STATE_FILE = ".worktree-dev.json";

export type WorktreeDevState = {
  dbName: string;
  dbHost: string;
  dbPort: number;
  bindings: DevBindings;
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function getWorktreeStatePath(worktreeRoot: string): string {
  return path.join(worktreeRoot, WORKTREE_STATE_FILE);
}

export async function readWorktreeState(worktreeRoot: string): Promise<WorktreeDevState | null> {
  const statePath = getWorktreeStatePath(worktreeRoot);
  if (!(await pathExists(statePath))) return null;

  const raw = await readFile(statePath, "utf8");
  return JSON.parse(raw) as WorktreeDevState;
}

export async function writeWorktreeState(worktreeRoot: string, state: WorktreeDevState): Promise<void> {
  const statePath = getWorktreeStatePath(worktreeRoot);
  const temporaryPath = `${statePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, statePath);
  } finally {
    try {
      await unlink(temporaryPath);
    } catch (error: unknown) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
  }
}

export async function deleteWorktreeState(worktreeRoot: string): Promise<void> {
  const statePath = getWorktreeStatePath(worktreeRoot);
  if (await pathExists(statePath)) {
    await unlink(statePath);
  }
}
