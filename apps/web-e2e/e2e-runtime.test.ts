import { afterEach, describe, expect, it } from "vitest";

import { createE2eEnvironment, selectPortPair } from "./e2e-runtime.js";

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

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
});
