import dotenvx from "@dotenvx/dotenvx";

export function isE2eRuntime(): boolean {
  return process.env.CALIBRATE_E2E === "1";
}

/**
 * E2E values are supplied by the isolated runner and must never be replaced by
 * a developer's dotenv file. Missing values intentionally remain missing so
 * the consuming configuration validates and rejects an unsafe startup.
 */
export function getRuntimeEnvironmentValue(name: string): string | undefined {
  return isE2eRuntime() ? process.env[name] : dotenvx.get(name);
}
