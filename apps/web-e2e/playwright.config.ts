import { nxE2EPreset } from "@nx/playwright/preset";
import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { DevPortPair } from "../../packages/dev-bindings/src/ports.ts";

import { deriveDevBindings } from "../../packages/dev-bindings/src/derive-dev-bindings.ts";
import { WEB_PUBLIC_BASE_URL } from "../web-frontend/src/config/public-base-path.ts";

function readE2ePorts(): DevPortPair | undefined {
  const frontend = process.env.E2E_FRONTEND_PORT;
  const backend = process.env.E2E_BACKEND_PORT;

  if (frontend === undefined && backend === undefined) {
    return undefined;
  }

  return {
    frontend: requireE2ePort("E2E_FRONTEND_PORT", frontend),
    backend: requireE2ePort("E2E_BACKEND_PORT", backend),
  };
}

function requireE2ePort(name: string, value: string | undefined): number {
  const port = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(`${name} must be an available unprivileged TCP port`);
  }

  return port;
}

const configPath = fileURLToPath(import.meta.url);
const workspaceRoot = resolve(dirname(configPath), "../..");
const ports = readE2ePorts();
const bindings = ports ? deriveDevBindings(ports) : undefined;
const frontendUrl = bindings?.frontendUrl ?? "http://127.0.0.1:0";
const frontendBaseUrl = new URL(WEB_PUBLIC_BASE_URL, frontendUrl).toString();
const screenshot = process.env.CALIBRATE_E2E_CAPTURE_SCREENSHOTS === "1" ? "on" : "only-on-failure";

export default defineConfig({
  ...nxE2EPreset(configPath, { testDir: "./e2e" }),
  outputDir: "test-output/playwright/results",
  use: {
    baseURL: frontendBaseUrl,
    screenshot,
    trace: "retain-on-failure",
  },
  webServer: bindings
    ? [
        {
          name: "frontend",
          command: "npx nx run web:e2e-dev",
          url: frontendUrl,
          reuseExistingServer: false,
          timeout: 120_000,
          cwd: workspaceRoot,
          env: {
            E2E_FRONTEND_PORT: String(bindings.ports.frontend),
            VITE_API_BASE_URL: bindings.viteApiBaseUrl,
          },
        },
        {
          name: "backend",
          command: "npx nx run backend:e2e-dev",
          url: `${bindings.backendUrl}/health`,
          reuseExistingServer: false,
          timeout: 120_000,
          cwd: workspaceRoot,
          env: {
            PORT: String(bindings.ports.backend),
          },
        },
      ]
    : undefined,
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
