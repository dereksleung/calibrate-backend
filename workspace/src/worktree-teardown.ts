import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import { ensureEnvKeys } from "./env-keys.js";
import { isPrimaryWorktree } from "./git-worktree.js";
import { SHARED_DB_HOST, SHARED_DB_PORT } from "./print-dev-commands.js";
import { deriveLinkedWorktreeDatabaseName } from "./worktree-database-name.js";
import {
  deleteWorktreeState,
  getWorktreeStatePath,
  readWorktreeState,
  type WorktreeDevState,
} from "./worktree-state.js";
import { explainTeardownRefusal, isTeardownDatabaseAllowed } from "./worktree-teardown-guard.js";

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

export type DatabaseArgument =
  | { kind: "omitted" }
  | { kind: "provided"; value: string }
  | { kind: "invalid"; message: string };

export function parseDatabaseArgument(argv: string[]): DatabaseArgument {
  let result: DatabaseArgument = { kind: "omitted" };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    let value: string | undefined;

    if (argument === "--database") {
      value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        return {
          kind: "invalid",
          message: "Invalid --database argument. Pass --database <name>.",
        };
      }
      index += 1;
    } else if (argument.startsWith("--database=")) {
      value = argument.slice("--database=".length);
      if (!value) {
        return {
          kind: "invalid",
          message: "Invalid --database argument. Pass --database <name>.",
        };
      }
    } else {
      return {
        kind: "invalid",
        message: "Unexpected worktree teardown argument. Use --database <name>.",
      };
    }

    if (result.kind !== "omitted") {
      return {
        kind: "invalid",
        message: "Invalid --database argument. Pass --database once.",
      };
    }

    result = { kind: "provided", value };
  }

  return result;
}

export async function resolveTeardownDatabaseName(
  argv: string[],
  readState: () => Promise<WorktreeDevState | null> = () => readWorktreeState(workspaceRoot),
): Promise<string | undefined> {
  const databaseArgument = parseDatabaseArgument(argv);
  if (databaseArgument.kind === "invalid") {
    throw new Error(databaseArgument.message);
  }
  if (databaseArgument.kind === "provided") {
    return databaseArgument.value;
  }

  return (await readState())?.dbName;
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
  const databaseName = await resolveTeardownDatabaseName(argv);
  await ensureEnvKeys(workspaceRoot);

  if (!databaseName) {
    throw new Error(
      `Missing worktree database name. Pass --database <name> or run worktree-setup in this checkout first (${getWorktreeStatePath(workspaceRoot)}).`,
    );
  }

  const expectedWorktreeDbName = isPrimaryWorktree(workspaceRoot)
    ? undefined
    : deriveLinkedWorktreeDatabaseName(workspaceRoot);
  const primaryDbName = getDotenvValue("DB_NAME");
  if (!isTeardownDatabaseAllowed(databaseName, primaryDbName, expectedWorktreeDbName)) {
    throw new Error(explainTeardownRefusal(databaseName, primaryDbName, expectedWorktreeDbName));
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
