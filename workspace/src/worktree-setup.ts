import { deriveDevBindings } from "@calibrate/dev-bindings";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import { ensureEnvKeys } from "./env-keys.js";
import { isPrimaryWorktree } from "./git-worktree.js";
import {
  isTcpPortOpen,
  shouldStartComposePostgres,
  waitForPostgresReady,
} from "./postgres-health.js";
import { COMPOSE_PROJECT_NAME, printDevCommands, SHARED_DB_HOST, SHARED_DB_PORT } from "./print-dev-commands.js";
import { deriveLinkedWorktreeDatabaseName } from "./worktree-database-name.js";
import { resolveStickyPortPair } from "./worktree-ports.js";
import { readWorktreeState, writeWorktreeState } from "./worktree-state.js";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

export function createSetupEnvironment(environment: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const setupEnvironment = { ...environment };
  delete setupEnvironment.CALIBRATE_E2E;
  return setupEnvironment;
}

function getDotenvValue(name: string): string {
  const value = execFileSync(npxCommand, ["dotenvx", "get", name], {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: createSetupEnvironment(),
  }).trim();

  if (!value) {
    throw new Error(`Missing required dotenv value: ${name}`);
  }

  return value;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function ensureSharedPostgres(): Promise<void> {
  const isOpen = await isTcpPortOpen(SHARED_DB_HOST, SHARED_DB_PORT);
  if (!shouldStartComposePostgres(isOpen)) {
    console.log(`Shared Postgres already accepting connections on ${SHARED_DB_HOST}:${SHARED_DB_PORT}.`);
  } else {
    console.log(`Starting shared Postgres with COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}...`);
    execFileSync(npxCommand, ["dotenvx", "run", "--", "docker", "compose", "up", "-d", "postgres"], {
      cwd: workspaceRoot,
      stdio: "inherit",
      env: {
        ...createSetupEnvironment(),
        COMPOSE_PROJECT_NAME,
      },
    });
  }

  const connectionOptions = {
    database: "postgres",
    host: SHARED_DB_HOST,
    port: SHARED_DB_PORT,
    user: getDotenvValue("DB_USER"),
    password: getDotenvValue("DB_PASSWORD"),
    connectionTimeoutMillis: 1_000,
  };

  await waitForPostgresReady(async () => {
    const pool = new Pool(connectionOptions);
    try {
      await pool.query("SELECT 1");
    } finally {
      await pool.end();
    }
  });
}

async function createDatabaseIfMissing(dbName: string): Promise<void> {
  const pool = new Pool({
    database: "postgres",
    host: SHARED_DB_HOST,
    port: SHARED_DB_PORT,
    user: getDotenvValue("DB_USER"),
    password: getDotenvValue("DB_PASSWORD"),
  });

  try {
    const existing = await pool.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (existing.rowCount === 0) {
      await pool.query(`CREATE DATABASE ${quoteIdentifier(dbName)}`);
      console.log(`Created database ${dbName}.`);
      return;
    }

    console.log(`Database ${dbName} already exists.`);
  } finally {
    await pool.end();
  }
}

function runMigrations(dbName: string): void {
  execFileSync(
    npxCommand,
    [
      "dotenvx",
      "run",
      "--overload",
      "--env",
      `DB_NAME=${dbName}`,
      "--env",
      `DB_HOST=${SHARED_DB_HOST}`,
      "--env",
      `DB_PORT=${SHARED_DB_PORT}`,
      "--env",
      "CALIBRATE_E2E=",
      "--",
      "npx",
      "nx",
      "run",
      "backend:kysely",
      "migrate:latest",
    ],
    {
      cwd: workspaceRoot,
      stdio: "inherit",
      env: createSetupEnvironment(),
    },
  );
}

function resolveDatabaseName(): string {
  if (isPrimaryWorktree(workspaceRoot)) {
    return getDotenvValue("DB_NAME");
  }

  return deriveLinkedWorktreeDatabaseName(workspaceRoot);
}

export async function runWorktreeSetup(): Promise<void> {
  await ensureEnvKeys(workspaceRoot);
  await ensureSharedPostgres();

  const dbName = resolveDatabaseName();
  await createDatabaseIfMissing(dbName);
  runMigrations(dbName);

  const previousState = await readWorktreeState(workspaceRoot);
  const ports = await resolveStickyPortPair(previousState?.bindings.ports);
  const bindings = deriveDevBindings(ports);

  await writeWorktreeState(workspaceRoot, {
    dbName,
    dbHost: SHARED_DB_HOST,
    dbPort: SHARED_DB_PORT,
    bindings,
  });

  console.log(`Worktree database: ${dbName}`);
  printDevCommands(bindings, dbName);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runWorktreeSetup().catch((error: unknown) => {
    console.error("worktree-setup failed.", error);
    process.exitCode = 1;
  });
}
