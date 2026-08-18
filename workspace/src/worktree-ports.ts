import { canBindLocalhost, type DevPortPair } from "@calibrate/dev-bindings";
import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const FIRST_CANDIDATE_PORT = 1;
const LAST_FRONTEND_PORT = 65_534;

type PortClaim = {
  worktreeKey: string;
  frontend: number;
  backend: number;
};

export type WorktreePortOptions = {
  claimDirectory?: string;
  worktreeRoot?: string;
};

export function getWorktreePortClaimDirectory(): string {
  return path.join(homedir(), ".calibrate", "worktree-ports");
}

function getWorktreeKey(worktreeRoot: string): string {
  return createHash("sha256").update(path.resolve(worktreeRoot)).digest("hex");
}

function isValidPortPair(pair: DevPortPair): boolean {
  return (
    Number.isInteger(pair.frontend) &&
    Number.isInteger(pair.backend) &&
    pair.frontend >= FIRST_CANDIDATE_PORT &&
    pair.backend <= 65_535 &&
    pair.backend === pair.frontend + 1
  );
}

function getClaimPath(claimDirectory: string, pair: DevPortPair): string {
  return path.join(claimDirectory, `${pair.frontend}-${pair.backend}.json`);
}

async function readPortClaim(claimPath: string): Promise<PortClaim | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(claimPath, "utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("worktreeKey" in parsed) ||
      !("frontend" in parsed) ||
      !("backend" in parsed) ||
      typeof parsed.worktreeKey !== "string" ||
      typeof parsed.frontend !== "number" ||
      typeof parsed.backend !== "number"
    ) {
      return null;
    }

    return parsed as PortClaim;
  } catch {
    return null;
  }
}

function isErrorWithCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

async function claimPortPair(
  pair: DevPortPair,
  worktreeKey: string,
  claimDirectory: string,
): Promise<boolean> {
  const claimPath = getClaimPath(claimDirectory, pair);
  const existingClaim = await readPortClaim(claimPath);
  if (existingClaim) {
    return existingClaim.worktreeKey === worktreeKey;
  }

  if (!(await canBindLocalhost(pair.frontend)) || !(await canBindLocalhost(pair.backend))) {
    return false;
  }

  await mkdir(claimDirectory, { recursive: true });
  const temporaryPath = `${claimPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify({ worktreeKey, ...pair } satisfies PortClaim)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    try {
      await link(temporaryPath, claimPath);
      return true;
    } catch (error: unknown) {
      if (!isErrorWithCode(error, "EEXIST")) throw error;
      const competingClaim = await readPortClaim(claimPath);
      return competingClaim?.worktreeKey === worktreeKey;
    }
  } finally {
    try {
      await unlink(temporaryPath);
    } catch (error: unknown) {
      if (!isErrorWithCode(error, "ENOENT")) throw error;
    }
  }
}

function getFirstCandidatePort(startPort: number): number {
  if (!Number.isInteger(startPort) || startPort < FIRST_CANDIDATE_PORT || startPort > LAST_FRONTEND_PORT) {
    throw new Error("startPort must be an integer between 1 and 65534");
  }

  return startPort % 2 === 0 ? startPort : startPort + 1;
}

export async function resolveStickyPortPair(
  previous: DevPortPair | undefined,
  startPort = 3000,
  options: WorktreePortOptions = {},
): Promise<DevPortPair> {
  const worktreeRoot = options.worktreeRoot ?? process.cwd();
  const claimDirectory = options.claimDirectory ?? getWorktreePortClaimDirectory();
  const worktreeKey = getWorktreeKey(worktreeRoot);

  if (previous && isValidPortPair(previous) && await claimPortPair(previous, worktreeKey, claimDirectory)) {
    return previous;
  }

  const firstPort = getFirstCandidatePort(startPort);
  for (let frontend = firstPort; frontend <= LAST_FRONTEND_PORT; frontend += 2) {
    const pair = { frontend, backend: frontend + 1 };
    if (await claimPortPair(pair, worktreeKey, claimDirectory)) {
      return pair;
    }
  }

  throw new Error("No adjacent localhost port pair is available");
}

export async function releaseWorktreePortClaims(
  worktreeRoot: string,
  claimDirectory = getWorktreePortClaimDirectory(),
): Promise<void> {
  let entries;
  try {
    entries = await readdir(claimDirectory, { withFileTypes: true });
  } catch (error: unknown) {
    if (isErrorWithCode(error, "ENOENT")) return;
    throw error;
  }

  const worktreeKey = getWorktreeKey(worktreeRoot);
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const claimPath = path.join(claimDirectory, entry.name);
        const claim = await readPortClaim(claimPath);
        if (claim?.worktreeKey !== worktreeKey) return;

        try {
          await unlink(claimPath);
        } catch (error: unknown) {
          if (!isErrorWithCode(error, "ENOENT")) throw error;
        }
      }),
  );
}
