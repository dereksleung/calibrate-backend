import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createE2eEnvironment,
  createPlaywrightTargetArguments,
  selectE2ePortPair,
  selectPortPair,
} from "./e2e-runtime.js";

const originalEnvironment = { ...process.env };
const temporaryDirectories: string[] = [];

afterEach(async () => {
  process.env = { ...originalEnvironment };
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "calibrate-e2e-runtime-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("E2E runtime", () => {
  it("creates an isolated environment for the selected application ports", () => {
    process.env.EMAIL_SERVICE_CREDENTIAL = "developer-credential";
    const environment = createE2eEnvironment(
      {
        database: "calibrate_e2e_test",
        host: "127.0.0.1",
        maxConnections: 10,
        password: "database-password",
        port: 54_321,
        user: "calibrate_e2e",
      },
      { frontend: 43_100, backend: 43_101 },
    );

    expect(environment).toMatchObject({
      CALIBRATE_E2E: "1",
      CORS_ORIGIN: "http://localhost:43100",
      DB_NAME: "calibrate_e2e_test",
      E2E_BACKEND_PORT: "43101",
      E2E_FRONTEND_PORT: "43100",
      EMAIL_SERVICE_CREDENTIAL: "",
      VITE_API_BASE_URL: "http://localhost:43101/api/v1",
      WEBAUTHN_ORIGIN: "http://localhost:43100",
      WEBAUTHN_RP_ID: "localhost",
    });
    expect(environment.OTP_HMAC_KEY).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(environment.EMAIL_REQUEST_IP_HMAC_KEY).toMatch(/^[a-f0-9]{64}$/);
    expect(environment.JWT_PRIVATE_KEY_PEM).toContain("BEGIN PRIVATE KEY");
  });

  it("selects an adjacent unprivileged localhost port pair", async () => {
    const ports = await selectPortPair(43_100);

    expect(ports.frontend).toBeGreaterThanOrEqual(43_100);
    expect(ports.frontend % 2).toBe(0);
    expect(ports.backend).toBe(ports.frontend + 1);
  });

  it("selects E2E ports from the dedicated pool", async () => {
    const ports = await selectE2ePortPair({ claimDirectory: await createTemporaryDirectory() });

    expect(ports.frontend).toBeGreaterThanOrEqual(40_000);
    expect(ports.frontend).toBeLessThanOrEqual(49_998);
    expect(ports.frontend % 2).toBe(0);
    expect(ports.backend).toBe(ports.frontend + 1);
  });

  it("skips persisted worktree port claims and tolerates a missing claim directory", async () => {
    const claimDirectory = await createTemporaryDirectory();
    await writeFile(
      path.join(claimDirectory, "43100-43101.json"),
      JSON.stringify({ backend: 43_101, frontend: 43_100, worktreeKey: "worktree" }),
    );

    await expect(
      selectE2ePortPair({
        claimDirectory,
        lastFrontendPort: 43_104,
        startPort: 43_100,
      }),
    ).resolves.toEqual({ backend: 43_103, frontend: 43_102 });

    const missingClaimDirectory = path.join(await createTemporaryDirectory(), "worktree-ports");
    await expect(
      selectE2ePortPair({
        claimDirectory: missingClaimDirectory,
        lastFrontendPort: 43_100,
        startPort: 43_100,
      }),
    ).resolves.toEqual({ backend: 43_101, frontend: 43_100 });
  });

  it("forwards E2E CLI arguments to the inferred Playwright target", () => {
    expect(createPlaywrightTargetArguments(["--grep", "local development passkey signup"])).toEqual([
      "nx",
      "run",
      "web-e2e:parameterize-playwright",
      "--outputStyle=static",
      "--",
      "--grep",
      "local development passkey signup",
    ]);
  });
});
