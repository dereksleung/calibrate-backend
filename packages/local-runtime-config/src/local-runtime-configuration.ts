import { generateKeyPairSync, randomBytes } from "node:crypto";
import { access, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const LOCAL_RUNTIME_ENV_FILE_NAME = ".local.env";

const LOCAL_RUNTIME_FILE_HEADER = [
  "# Calibrate local-only runtime configuration.",
  "# Unique to this checkout. Do not commit or use in production.",
  "",
].join("\n");

const REQUIRED_ENV_KEYS = [
  "JWT_PRIVATE_KEY_PEM",
  "OTP_HMAC_KEY",
  "OTP_HMAC_CURRENT_KEY_VERSION",
  "EMAIL_REQUEST_IP_HMAC_KEY",
  "JWT_ISSUER",
  "JWT_AUDIENCE",
  "JWT_ACCESS_TOKEN_TTL_SECONDS",
] as const;

export type LocalRuntimeConfiguration = {
  jwtPrivateKeyPem: string;
  otpHmacKey: string;
  otpHmacCurrentKeyVersion: string;
  emailRequestIpHmacKey: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtAccessTokenTtlSeconds: string;
};

export function getLocalRuntimeEnvFilePath(directory: string): string {
  return path.join(directory, LOCAL_RUNTIME_ENV_FILE_NAME);
}

export function generateLocalRuntimeConfiguration(): LocalRuntimeConfiguration {
  const jwtPrivateKeyPem = generateKeyPairSync("ed25519")
    .privateKey.export({ type: "pkcs8", format: "pem" })
    .toString()
    .trim();

  return {
    jwtPrivateKeyPem,
    otpHmacKey: randomBytes(32).toString("base64url"),
    otpHmacCurrentKeyVersion: "1",
    emailRequestIpHmacKey: randomBytes(32).toString("hex"),
    jwtIssuer: "calibrate-local",
    jwtAudience: "calibrate-local",
    jwtAccessTokenTtlSeconds: "900",
  };
}

export function localRuntimeConfigurationToProcessEnv(
  configuration: LocalRuntimeConfiguration,
): Record<(typeof REQUIRED_ENV_KEYS)[number], string> {
  return {
    JWT_PRIVATE_KEY_PEM: configuration.jwtPrivateKeyPem,
    OTP_HMAC_KEY: configuration.otpHmacKey,
    OTP_HMAC_CURRENT_KEY_VERSION: configuration.otpHmacCurrentKeyVersion,
    EMAIL_REQUEST_IP_HMAC_KEY: configuration.emailRequestIpHmacKey,
    JWT_ISSUER: configuration.jwtIssuer,
    JWT_AUDIENCE: configuration.jwtAudience,
    JWT_ACCESS_TOKEN_TTL_SECONDS: configuration.jwtAccessTokenTtlSeconds,
  };
}

export async function readLocalRuntimeConfiguration(
  directory: string,
): Promise<LocalRuntimeConfiguration | null> {
  const filePath = getLocalRuntimeEnvFilePath(directory);
  if (!(await pathExists(filePath))) return null;

  return parseLocalRuntimeEnvFile(await readFile(filePath, "utf8"), filePath);
}

export async function writeLocalRuntimeConfiguration(
  directory: string,
  configuration: LocalRuntimeConfiguration,
): Promise<void> {
  const filePath = getLocalRuntimeEnvFilePath(directory);
  const temporaryPath = `${filePath}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await writeFile(temporaryPath, serializeLocalRuntimeEnvFile(configuration), "utf8");
    await rename(temporaryPath, filePath);
  } finally {
    await removeTemporaryFile(temporaryPath);
  }
}

export async function ensureLocalRuntimeConfiguration(directory: string): Promise<LocalRuntimeConfiguration> {
  const existing = await readLocalRuntimeConfiguration(directory);
  if (existing) return existing;

  const generated = generateLocalRuntimeConfiguration();
  await writeLocalRuntimeConfiguration(directory, generated);
  return generated;
}

function serializeLocalRuntimeEnvFile(configuration: LocalRuntimeConfiguration): string {
  const env = localRuntimeConfigurationToProcessEnv(configuration);
  const assignments = REQUIRED_ENV_KEYS.map((name) => `${name}=${quoteEnvValue(env[name])}`);
  return `${LOCAL_RUNTIME_FILE_HEADER}${assignments.join("\n")}\n`;
}

function parseLocalRuntimeEnvFile(contents: string, filePath: string): LocalRuntimeConfiguration {
  const values = new Map<string, string>();

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      throw new Error(`Invalid local runtime configuration in ${filePath}`);
    }

    values.set(line.slice(0, separatorIndex), unquoteEnvValue(line.slice(separatorIndex + 1), filePath));
  }

  return {
    jwtPrivateKeyPem: requiredEnvValue(values, "JWT_PRIVATE_KEY_PEM", filePath),
    otpHmacKey: requiredEnvValue(values, "OTP_HMAC_KEY", filePath),
    otpHmacCurrentKeyVersion: requiredEnvValue(values, "OTP_HMAC_CURRENT_KEY_VERSION", filePath),
    emailRequestIpHmacKey: requiredEnvValue(values, "EMAIL_REQUEST_IP_HMAC_KEY", filePath),
    jwtIssuer: requiredEnvValue(values, "JWT_ISSUER", filePath),
    jwtAudience: requiredEnvValue(values, "JWT_AUDIENCE", filePath),
    jwtAccessTokenTtlSeconds: requiredEnvValue(values, "JWT_ACCESS_TOKEN_TTL_SECONDS", filePath),
  };
}

function requiredEnvValue(values: Map<string, string>, name: string, filePath: string): string {
  const value = values.get(name);
  if (!value) {
    throw new Error(`Invalid local runtime configuration in ${filePath}`);
  }

  return value;
}

function quoteEnvValue(value: string): string {
  return JSON.stringify(value);
}

function unquoteEnvValue(value: string, filePath: string): string {
  if (!(value.startsWith('"') && value.endsWith('"') && value.length >= 2)) {
    return value;
  }

  try {
    return JSON.parse(value) as string;
  } catch {
    throw new Error(`Invalid local runtime configuration in ${filePath}`);
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function removeTemporaryFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}
