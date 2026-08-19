import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ensureEnvKeys } from "./env-keys.js";

type GitWorktreeFixture = {
  root: string;
  primary: string;
  linked: string;
};

const fixtures: string[] = [];
let originalDotenvPrivateKey: string | undefined;

function runGit(primary: string, args: string[]): void {
  execFileSync("git", ["-C", primary, ...args], { stdio: "ignore" });
}

async function createGitWorktreeFixture(): Promise<GitWorktreeFixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), "calibrate-env-keys-"));
  fixtures.push(root);

  const primary = path.join(root, "primary");
  const linked = path.join(root, "linked");

  execFileSync("git", ["init", primary], { stdio: "ignore" });
  await writeFile(path.join(primary, "tracked.txt"), "fixture\n");
  runGit(primary, ["add", "tracked.txt"]);
  runGit(primary, ["config", "user.name", "Calibrate test"]);
  runGit(primary, ["config", "user.email", "calibrate-test@example.com"]);
  runGit(primary, ["commit", "-m", "fixture"]);
  runGit(primary, ["worktree", "add", "--detach", "--no-checkout", linked, "HEAD"]);

  return { root, primary, linked };
}

describe("ensureEnvKeys", () => {
  beforeEach(() => {
    originalDotenvPrivateKey = process.env.DOTENV_PRIVATE_KEY;
    delete process.env.DOTENV_PRIVATE_KEY;
  });

  afterEach(async () => {
    if (originalDotenvPrivateKey === undefined) {
      delete process.env.DOTENV_PRIVATE_KEY;
    } else {
      process.env.DOTENV_PRIVATE_KEY = originalDotenvPrivateKey;
    }

    await Promise.all(fixtures.splice(0).map((fixture) => rm(fixture, { force: true, recursive: true })));
  });

  it("copies .env.keys from the primary checkout listed by git", async () => {
    const fixture = await createGitWorktreeFixture();
    const keyContents = "DOTENV_PRIVATE_KEY=throwaway-fixture-key\n";
    await writeFile(path.join(fixture.primary, ".env.keys"), keyContents);

    await ensureEnvKeys(fixture.linked);

    await expect(readFile(path.join(fixture.linked, ".env.keys"), "utf8")).resolves.toBe(keyContents);
  });

  it("fails closed when no local, process, or listed-checkout key exists", async () => {
    const fixture = await createGitWorktreeFixture();

    await expect(ensureEnvKeys(fixture.linked)).rejects.toThrow("Missing dotenvx private key");
  });
});
