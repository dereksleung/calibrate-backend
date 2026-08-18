import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import { ensureEnvKeys } from "./env-keys.js";
import { SHARED_DB_HOST, SHARED_DB_PORT } from "./print-dev-commands.js";
import {
  deleteWorktreeState,
  getWorktreeStatePath,
  readWorktreeState,
} from "./worktree-state.js";
import {
  explainTeardownRefusal,
  isTeardownDatabaseAllowed,
} from "./worktree-teardown-guard.js";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function getDotenvValue(name: string): string {
  const value = execSync(`npx dotenvx get ${name}`, {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: process.env,
  }).trim();

  if (!value) {
    throw new Error(`Missing required dotenv value: ${name}`);
  }

  return value;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function parseDatabaseArgument(argv: string[]): string | undefined {
  const index = argv.indexOf("--database");
  if (index === -1) return undefined;
  return argv[index + 1];
}

async function dropDatabase(dbName: string): Promise<void> {
  const pool = new Pool({
    database: "postgres",
    host: SHARED_DB_HOST,
    port: SHARED_DB_PORT,
    user: getDotenvValue("DB_USER"),
    password: getDotenvValue("DB_PASSWORD"),
  });

  try {
    await pool.query(`DROP DATABASE ${quoteIdentifier(dbName)} WITH (FORCE)`);
    console.log(`Dropped database ${dbName}.`);
  } finally {
    await pool.end();
  }
}

export async function runWorktreeTeardown(argv = process.argv.slice(2)): Promise<void> {
  await ensureEnvKeys(workspaceRoot);

  const state = await readWorktreeState(workspaceRoot);
  const databaseName = parseDatabaseArgument(argv) ?? state?.dbName;
  if (!databaseName) {
    throw new Error(
      `Missing worktree database name. Pass --database <name> or run worktree-setup in this checkout first (${getWorktreeStatePath(workspaceRoot)}).`,
    );
  }

  const primaryDbName = getDotenvValue("DB_NAME");
  if (!isTeardownDatabaseAllowed(databaseName, primaryDbName)) {
    throw new Error(explainTeardownRefusal(databaseName, primaryDbName));
  }

  await dropDatabase(databaseName);
  await deleteWorktreeState(workspaceRoot);
  console.log("Deleted .worktree-dev.json. Shared Postgres is still running.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runWorktreeTeardown().catch((error: unknown) => {
    console.error("worktree-teardown failed.", error);
    process.exitCode = 1;
  });
}
