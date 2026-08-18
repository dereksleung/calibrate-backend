import type { DevBindings } from "@calibrate/dev-bindings";

export const SHARED_DB_HOST = "127.0.0.1";
export const SHARED_DB_PORT = 5433;
export const COMPOSE_PROJECT_NAME = "calibrate-shared";

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

export function dotenvEnvAssignment(name: string, value: string): string {
  if (value.includes("'") || value.includes("\r") || value.includes("\n")) {
    throw new Error(`${name} contains unsupported dotenv characters.`);
  }

  return `${name}='${value}'`;
}

export function formatBackendDevCommand(bindings: DevBindings, dbName: string): string {
  return [
    "npx dotenvx run --overload",
    "--env CALIBRATE_E2E=",
    `--env DB_HOST=${shellQuote(SHARED_DB_HOST)}`,
    `--env DB_PORT=${shellQuote(String(SHARED_DB_PORT))}`,
    `--env ${shellQuote(dotenvEnvAssignment("DB_NAME", dbName))}`,
    `--env PORT=${shellQuote(String(bindings.ports.backend))}`,
    `--env CORS_ORIGIN=${shellQuote(bindings.corsOrigin)}`,
    `--env WEBAUTHN_ORIGIN=${shellQuote(bindings.webauthnOrigin)}`,
    "-- npx nx run backend:dev",
  ].join(" ");
}

export function formatWebDevCommand(bindings: DevBindings): string {
  return [
    "npx dotenvx run --overload",
    "--env CALIBRATE_E2E=",
    `--env VITE_API_BASE_URL=${shellQuote(bindings.viteApiBaseUrl)}`,
    `-- npx nx run web:dev -- --port ${shellQuote(String(bindings.ports.frontend))}`,
  ].join(" ");
}

export function printDevCommands(bindings: DevBindings, dbName: string): void {
  console.log("\nWorktree dev servers are ready. Start them in separate terminals:\n");
  console.log(formatBackendDevCommand(bindings, dbName));
  console.log(formatWebDevCommand(bindings));
  console.log("");
}
