import { access, copyFile } from "node:fs/promises";
import path from "node:path";

import { getPrimaryWorktreePath } from "./git-worktree.js";

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureEnvKeys(worktreeRoot: string): Promise<void> {
  const localKeysPath = path.join(worktreeRoot, ".env.keys");
  if ((await pathExists(localKeysPath)) || process.env.DOTENV_PRIVATE_KEY) {
    return;
  }

  const primaryKeysPath = path.join(getPrimaryWorktreePath(worktreeRoot), ".env.keys");
  if (await pathExists(primaryKeysPath)) {
    await copyFile(primaryKeysPath, localKeysPath);
    console.log(`Copied .env.keys from ${primaryKeysPath}`);
    return;
  }

  throw new Error(
    "Missing dotenvx private key. Set DOTENV_PRIVATE_KEY or copy .env.keys into this worktree.",
  );
}
