import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

import {
  canBindLocalhost,
  deriveDevBindings,
  selectPortPair,
  type DevPortPair,
} from "@calibrate/dev-bindings";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { FileMigrationProvider, Kysely, Migrator, PostgresDialect } from "kysely";
import { spawn } from "node:child_process";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const POSTGRES_IMAGE = "postgres:18";
const MAX_PORT_ATTEMPTS = 5;
const E2E_PORT_POOL_START = 40_000;
const E2E_PORT_POOL_LAST_FRONTEND = 49_998;
const WORKTREE_PORT_CLAIM_DIRECTORY = path.join(homedir(), ".calibrate", "worktree-ports");
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationFolder = path.join(workspaceRoot, "apps/backend/src/infrastructure/persistence/migrations");

export type E2ePorts = DevPortPair;
type DatabaseConnectionConfig = {
  database: string;
  host: string;
  port: number;
  user: string;
  password: string;
  maxConnections: number;
};

export { canBindLocalhost, selectPortPair };

export type E2ePortSelectionOptions = {
  claimDirectory?: string;
  lastFrontendPort?: number;
  startPort?: number;
};

function isErrorWithCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function parseClaimedPortPair(fileName: string): DevPortPair | undefined {
  const match = /^(\d+)-(\d+)\.json$/.exec(fileName);
  if (!match) return undefined;

  const frontend = Number(match[1]);
  const backend = Number(match[2]);
  if (
    !Number.isSafeInteger(frontend) ||
    !Number.isSafeInteger(backend) ||
    frontend < 1 ||
    backend > 65_535 ||
    backend !== frontend + 1
  ) {
    return undefined;
  }

  return { frontend, backend };
}

async function readClaimedPortPairs(claimDirectory: string): Promise<Set<string>> {
  let entries;
  try {
    entries = await fs.readdir(claimDirectory, { withFileTypes: true });
  } catch (error: unknown) {
    if (isErrorWithCode(error, "ENOENT")) return new Set();
    throw error;
  }

  const claimedPairs = new Set<string>();
  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const pair = parseClaimedPortPair(entry.name);
    if (pair) claimedPairs.add(`${pair.frontend}-${pair.backend}`);
  }
  return claimedPairs;
}

function getFirstE2ePort(startPort: number): number {
  if (!Number.isInteger(startPort) || startPort < 1 || startPort > 65_534) {
    throw new Error("startPort must be an integer between 1 and 65534");
  }

  return startPort % 2 === 0 ? startPort : startPort + 1;
}

export async function selectE2ePortPair(options: E2ePortSelectionOptions = {}): Promise<E2ePorts> {
  const firstPort = getFirstE2ePort(options.startPort ?? E2E_PORT_POOL_START);
  const lastFrontendPort = options.lastFrontendPort ?? E2E_PORT_POOL_LAST_FRONTEND;
  if (!Number.isInteger(lastFrontendPort) || lastFrontendPort < firstPort || lastFrontendPort > 65_534) {
    throw new Error("lastFrontendPort must be an integer between the start port and 65534");
  }

  const claimDirectory = options.claimDirectory ?? WORKTREE_PORT_CLAIM_DIRECTORY;
  const claimedPairs = await readClaimedPortPairs(claimDirectory);
  for (let frontend = firstPort; frontend <= lastFrontendPort; frontend += 2) {
    const backend = frontend + 1;
    if (claimedPairs.has(`${frontend}-${backend}`)) continue;

    if ((await canBindLocalhost(frontend)) && (await canBindLocalhost(backend))) {
      return { frontend, backend };
    }
  }

  throw new Error("No E2E localhost port pair is available in the E2E port pool");
}

export function createE2eEnvironment(database: DatabaseConnectionConfig, ports: E2ePorts): NodeJS.ProcessEnv {
  const bindings = deriveDevBindings(ports);
  const privateKeyPem = generateKeyPairSync("ed25519")
    .privateKey.export({ type: "pkcs8", format: "pem" })
    .toString();

  return {
    ...process.env,
    CALIBRATE_E2E: "1",
    CORS_ORIGIN: bindings.corsOrigin,
    DB_HOST: database.host,
    DB_NAME: database.database,
    DB_PASSWORD: database.password,
    DB_PORT: String(database.port),
    DB_USER: database.user,
    EMAIL_REQUEST_IP_HMAC_KEY: randomBytes(32).toString("hex"),
    EMAIL_SERVICE_CREDENTIAL: "",
    EMAIL_VERIFICATION_GLOBAL_HOURLY_LIMIT: "1000",
    E2E_BACKEND_PORT: String(ports.backend),
    E2E_FRONTEND_PORT: String(ports.frontend),
    JWT_ACCESS_TOKEN_TTL_SECONDS: "900",
    JWT_AUDIENCE: "calibrate-e2e",
    JWT_ISSUER: "calibrate-e2e",
    JWT_PRIVATE_KEY_PEM: privateKeyPem,
    OTP_HMAC_KEY: randomBytes(32).toString("base64url"),
    OTP_HMAC_CURRENT_KEY_VERSION: "1",
    PORT: String(ports.backend),
    TRUST_PROXY_HOPS: "0",
    VITE_API_BASE_URL: bindings.viteApiBaseUrl,
    WEBAUTHN_ORIGIN: bindings.webauthnOrigin,
    WEBAUTHN_RP_ID: "localhost",
  };
}

async function migrateDatabase(database: DatabaseConnectionConfig): Promise<void> {
  const client = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        database: database.database,
        host: database.host,
        max: database.maxConnections,
        password: database.password,
        port: database.port,
        user: database.user,
      }),
    }),
  });

  try {
    const migrator = new Migrator({
      db: client,
      provider: new FileMigrationProvider({ fs, path, migrationFolder }),
    });
    const { error } = await migrator.migrateToLatest();
    if (error) throw error;
  } finally {
    await client.destroy();
  }
}

async function startDatabase(): Promise<{
  container: StartedPostgreSqlContainer;
  config: DatabaseConnectionConfig;
}> {
  const password = randomBytes(24).toString("base64url");
  const databaseName = `calibrate_e2e_${randomUUID().replaceAll("-", "")}`;
  let container: StartedPostgreSqlContainer | undefined;

  try {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE)
      .withDatabase(databaseName)
      .withUsername("calibrate_e2e")
      .withPassword(password)
      .start();
    const config = {
      database: container.getDatabase(),
      host: container.getHost(),
      port: container.getPort(),
      user: container.getUsername(),
      password: container.getPassword(),
      maxConnections: 10,
    };
    await migrateDatabase(config);
    return { container, config };
  } catch (error) {
    await container?.stop();
    console.error("Failed to start or migrate the disposable E2E Postgres database.", error);
    throw error;
  }
}

export function createPlaywrightTargetArguments(playwrightArguments: string[]): string[] {
  return [
    "nx",
    "run",
    "web-e2e:parameterize-playwright",
    "--outputStyle=static",
    "--",
    ...playwrightArguments,
  ];
}

async function runNx(
  env: NodeJS.ProcessEnv,
  targetArguments: string[],
): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? "npx.cmd" : "npx";
    const child = spawn(command, targetArguments, {
      cwd: workspaceRoot,
      env,
      stdio: ["inherit", "pipe", "pipe"],
    });
    let output = "";
    const writeOutput = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    };
    const writeError = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    };
    const stopChild = () => child.kill("SIGTERM");
    process.once("SIGINT", stopChild);
    process.once("SIGTERM", stopChild);

    child.stdout.on("data", writeOutput);
    child.stderr.on("data", writeError);
    child.once("error", reject);
    child.once("close", (exitCode) => resolve({ exitCode: exitCode ?? 1, output }));
    child.once("close", () => {
      process.removeListener("SIGINT", stopChild);
      process.removeListener("SIGTERM", stopChild);
    });
  });
}

export async function run(): Promise<void> {
  const prerequisiteBuild = await runNx(process.env, [
    "nx",
    "run",
    "@calibrate/api-contracts:build",
    "--outputStyle=static",
  ]);
  if (prerequisiteBuild.exitCode !== 0) {
    throw new Error(`E2E prerequisite build failed with exit code ${prerequisiteBuild.exitCode}`);
  }

  const { container, config } = await startDatabase();
  const playwrightArguments = process.argv.slice(2);

  try {
    for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt += 1) {
      const ports = await selectE2ePortPair({ startPort: E2E_PORT_POOL_START + attempt * 2 });
      const result = await runNx(
        createE2eEnvironment(config, ports),
        createPlaywrightTargetArguments(playwrightArguments),
      );

      if (result.exitCode === 0) return;
      if (!result.output.includes("EADDRINUSE")) {
        throw new Error(`Playwright E2E execution failed with exit code ${result.exitCode}`);
      }

      console.warn(`E2E port collision on ${ports.frontend}/${ports.backend}; retrying with a new pair.`);
    }

    throw new Error(`E2E server startup collided with another process ${MAX_PORT_ATTEMPTS} times`);
  } finally {
    await container.stop();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error: unknown) => {
    console.error("E2E runtime failed.", error);
    process.exitCode = 1;
  });
}
