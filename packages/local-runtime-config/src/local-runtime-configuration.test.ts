import { execFileSync } from "node:child_process";
import { createHmac, createPrivateKey } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  ensureLocalRuntimeConfiguration,
  generateLocalRuntimeConfiguration,
  getLocalRuntimeEnvFilePath,
  LOCAL_RUNTIME_ENV_FILE_NAME,
  localRuntimeConfigurationToProcessEnv,
  readLocalRuntimeConfiguration,
  type LocalRuntimeConfiguration,
} from "./local-runtime-configuration.js";
import { runLocalDemoSetup } from "./local-demo-setup.js";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const originalCwd = process.cwd();
const originalDotenvPrivateKey = process.env.DOTENV_PRIVATE_KEY;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  process.chdir(originalCwd);
  if (originalDotenvPrivateKey === undefined) {
    delete process.env.DOTENV_PRIVATE_KEY;
  } else {
    process.env.DOTENV_PRIVATE_KEY = originalDotenvPrivateKey;
  }

  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "calibrate-local-runtime-"));
  temporaryDirectories.push(directory);
  return directory;
}

function assertUsableByBackendConsumers(configuration: LocalRuntimeConfiguration): void {
  const otpKeyBytes = Buffer.from(configuration.otpHmacKey, "base64url");
  expect(otpKeyBytes.byteLength).toBeGreaterThanOrEqual(32);
  expect(createHmac("sha256", otpKeyBytes).update("calibrate-email-otp").digest("base64url")).toMatch(
    /^[A-Za-z0-9_-]+$/,
  );

  const ipKeyBytes = Buffer.from(configuration.emailRequestIpHmacKey, "hex");
  expect(ipKeyBytes.byteLength).toBeGreaterThanOrEqual(32);
  expect(createHmac("sha256", ipKeyBytes).update("127.0.0.1").digest("base64url")).toMatch(
    /^[A-Za-z0-9_-]+$/,
  );

  const privateKey = createPrivateKey(configuration.jwtPrivateKeyPem);
  expect(privateKey.asymmetricKeyType).toBe("ed25519");
  expect(configuration.jwtIssuer).toBe("calibrate-local");
  expect(configuration.jwtAudience).toBe("calibrate-local");
  expect(configuration.jwtAccessTokenTtlSeconds).toBe("900");
  expect(configuration.otpHmacCurrentKeyVersion).toBe("1");
}

describe("local runtime configuration", () => {
  it("generates unique non-production Ed25519 and HMAC material without dotenvx files", async () => {
    const directory = await createTemporaryDirectory();
    process.chdir(directory);
    delete process.env.DOTENV_PRIVATE_KEY;

    const first = generateLocalRuntimeConfiguration();
    const second = generateLocalRuntimeConfiguration();

    assertUsableByBackendConsumers(first);
    assertUsableByBackendConsumers(second);
    expect(first.jwtPrivateKeyPem).not.toBe(second.jwtPrivateKeyPem);
    expect(first.otpHmacKey).not.toBe(second.otpHmacKey);
    expect(first.emailRequestIpHmacKey).not.toBe(second.emailRequestIpHmacKey);
    await expect(readLocalRuntimeConfiguration(directory)).resolves.toBeNull();
  });

  it("keeps cryptographic configuration separate from port and origin bindings", () => {
    const environment = localRuntimeConfigurationToProcessEnv(generateLocalRuntimeConfiguration());

    expect(environment).not.toHaveProperty("CORS_ORIGIN");
    expect(environment).not.toHaveProperty("PORT");
    expect(environment).not.toHaveProperty("VITE_API_BASE_URL");
    expect(environment).not.toHaveProperty("WEBAUTHN_ORIGIN");
    expect(environment).not.toHaveProperty("WEBAUTHN_RP_ID");
    expect(environment).not.toHaveProperty("DB_HOST");
    expect(environment).not.toHaveProperty("DB_NAME");
  });

  it("persists generated configuration for demo setup without reading or creating .env.keys", async () => {
    const directory = await createTemporaryDirectory();
    const ignoredKeysPath = path.join(directory, ".env.keys");
    await writeFile(ignoredKeysPath, "DOTENV_PRIVATE_KEY=must-not-be-required\n");
    process.chdir(directory);
    delete process.env.DOTENV_PRIVATE_KEY;

    const generated = await ensureLocalRuntimeConfiguration(directory);
    const reused = await ensureLocalRuntimeConfiguration(directory);
    const persisted = await readFile(getLocalRuntimeEnvFilePath(directory), "utf8");

    assertUsableByBackendConsumers(generated);
    assertUsableByBackendConsumers(reused);
    expect(reused).toEqual(generated);
    expect(persisted).toContain("Calibrate local-only runtime configuration");
    expect(persisted).toContain("Do not commit or use in production");
    expect(persisted).not.toContain("CORS_ORIGIN=");
    expect(persisted).not.toContain("WEBAUTHN_ORIGIN=");
    await expect(readFile(ignoredKeysPath, "utf8")).resolves.toBe(
      "DOTENV_PRIVATE_KEY=must-not-be-required\n",
    );
  });

  it("runs the local demo setup target with generated configuration", async () => {
    const directory = await createTemporaryDirectory();
    const ignoredKeysPath = path.join(directory, ".env.keys");
    await writeFile(ignoredKeysPath, "DOTENV_PRIVATE_KEY=must-not-be-required\n");
    delete process.env.DOTENV_PRIVATE_KEY;

    const generated = await runLocalDemoSetup(directory);
    const persisted = await readLocalRuntimeConfiguration(directory);

    expect(persisted).toEqual(generated);
    assertUsableByBackendConsumers(generated);
    await expect(readFile(ignoredKeysPath, "utf8")).resolves.toBe(
      "DOTENV_PRIVATE_KEY=must-not-be-required\n",
    );
  });

  it("excludes the generated local runtime file from version control", () => {
    const ignored = execFileSync("git", ["check-ignore", "--no-index", LOCAL_RUNTIME_ENV_FILE_NAME], {
      cwd: workspaceRoot,
      encoding: "utf8",
    }).trim();

    expect(ignored).toBe(LOCAL_RUNTIME_ENV_FILE_NAME);
  });
});
