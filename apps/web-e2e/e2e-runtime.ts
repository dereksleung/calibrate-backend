import { deriveDevBindings, selectPortPair, type DevPortPair } from "@calibrate/dev-bindings";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { FileMigrationProvider, Kysely, Migrator, PostgresDialect } from "kysely";
import { spawn } from "node:child_process";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const POSTGRES_IMAGE = "postgres:18";
const MAX_PORT_ATTEMPTS = 5;
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

export { canBindLocalhost, selectPortPair } from "@calibrate/dev-bindings";

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
      const ports = await selectPortPair(3000 + attempt * 2);
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
