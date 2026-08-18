import type { DevBindings } from "@calibrate/dev-bindings";

export const SHARED_DB_HOST = "127.0.0.1";
export const SHARED_DB_PORT = 5433;
export const COMPOSE_PROJECT_NAME = "calibrate-shared";

export function formatBackendDevCommand(bindings: DevBindings, dbName: string): string {
  return [
    "npx dotenvx run --overload",
    `--env DB_HOST=${SHARED_DB_HOST}`,
    `--env DB_PORT=${SHARED_DB_PORT}`,
    `--env DB_NAME=${dbName}`,
    `--env PORT=${bindings.ports.backend}`,
    `--env CORS_ORIGIN=${bindings.corsOrigin}`,
    `--env WEBAUTHN_ORIGIN=${bindings.webauthnOrigin}`,
    "-- npx nx run backend:dev",
  ].join(" ");
}

export function formatWebDevCommand(bindings: DevBindings): string {
  return [
    "npx dotenvx run --overload",
    `--env VITE_API_BASE_URL=${bindings.viteApiBaseUrl}`,
    `-- npx nx run web:dev -- --port ${bindings.ports.frontend}`,
  ].join(" ");
}

export function printDevCommands(bindings: DevBindings, dbName: string): void {
  console.log("\nWorktree dev servers are ready. Start them in separate terminals:\n");
  console.log(formatBackendDevCommand(bindings, dbName));
  console.log(formatWebDevCommand(bindings));
  console.log("");
}
