import { nxE2EPreset } from "@nx/playwright/preset";
import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type E2ePorts = {
  backend: number;
  frontend: number;
};

function readE2ePorts(): E2ePorts | undefined {
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
const frontendUrl = ports ? `http://localhost:${ports.frontend}` : "http://127.0.0.1:0";
const frontendBaseUrl = `${frontendUrl}/calibrate-monorepo/`;
const backendUrl = ports ? `http://localhost:${ports.backend}` : undefined;
const screenshot = process.env.CALIBRATE_E2E_CAPTURE_SCREENSHOTS === "1" ? "on" : "only-on-failure";

export default defineConfig({
  ...nxE2EPreset(configPath, { testDir: "./e2e" }),
  outputDir: "test-output/playwright/results",
  use: {
    baseURL: frontendBaseUrl,
    screenshot,
    trace: "retain-on-failure",
  },
  webServer: ports
    ? [
        {
          name: "frontend",
          command: "npx nx run web:e2e-dev",
          url: frontendUrl,
          reuseExistingServer: false,
          timeout: 120_000,
          cwd: workspaceRoot,
          env: {
            E2E_FRONTEND_PORT: String(ports.frontend),
            VITE_API_BASE_URL: `${backendUrl}/api/v1`,
          },
        },
        {
          name: "backend",
          command: "npx nx run backend:e2e-dev",
          url: `${backendUrl}/health`,
          reuseExistingServer: false,
          timeout: 120_000,
          cwd: workspaceRoot,
          env: {
            PORT: String(ports.backend),
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
