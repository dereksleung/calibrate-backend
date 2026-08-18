import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { releaseWorktreePortClaims, resolveStickyPortPair } from "./worktree-ports.js";

const claimDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(claimDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createClaimDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "calibrate-worktree-ports-"));
  claimDirectories.push(directory);
  return directory;
}

describe("resolveStickyPortPair", () => {
  it("reuses the previous port pair when both ports are still free", async () => {
    const claimDirectory = await createClaimDirectory();
    const options = { claimDirectory, worktreeRoot: "/worktrees/one" };
    const previous = await resolveStickyPortPair(undefined, 43_300, options);

    await expect(resolveStickyPortPair(previous, 43_300, options)).resolves.toEqual(previous);
  });

  it("selects a new pair when a persisted pair is no longer free", async () => {
    const claimDirectory = await createClaimDirectory();
    const options = { claimDirectory, worktreeRoot: "/worktrees/occupied" };
    const previous = await resolveStickyPortPair(undefined, 43_400, options);
    const server = createServer();

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(previous.frontend, "localhost", () => resolve());
    });

    try {
      await expect(resolveStickyPortPair(previous, previous.frontend, options)).resolves.toEqual({
        frontend: previous.frontend + 2,
        backend: previous.backend + 2,
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("claims a different pair for another worktree until the first claim is released", async () => {
    const claimDirectory = await createClaimDirectory();
    const firstOptions = { claimDirectory, worktreeRoot: "/worktrees/one" };
    const secondOptions = { claimDirectory, worktreeRoot: "/worktrees/two" };
    const first = await resolveStickyPortPair(undefined, 43_300, firstOptions);

    const second = await resolveStickyPortPair(undefined, first.frontend, secondOptions);
    expect(second).not.toEqual(first);

    await releaseWorktreePortClaims(firstOptions.worktreeRoot, claimDirectory);
    await expect(resolveStickyPortPair(undefined, first.frontend, secondOptions)).resolves.toEqual(first);
  });
});
