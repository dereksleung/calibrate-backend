import type { IAccountEmailVerificationService } from "@application/services/account-email-verification-service.js";
import type { IAuthService } from "@application/services/auth-service.js";
import type {
  ILocalDevelopmentPasskeyEnrollmentService,
  LocalDevelopmentPasskeyEnrollment,
} from "@application/services/local-development-passkey-enrollment-service.js";
import type { ISignupPasskeyRegistrationService } from "@application/services/signup-passkey-registration-service.js";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AuthController } from "../../controllers/auth-controller.js";
import { createAuthRoutes } from "../auth-routes.js";

describe("local development auth route", () => {
  const originalEnvironment = { ...process.env };
  const enrollment: LocalDevelopmentPasskeyEnrollment = {
    token: "local-enrollment-token",
    email: "local-123@example.test",
    expiresAt: new Date("2030-01-01T00:05:00.000Z"),
  };
  const localEnrollmentService: ILocalDevelopmentPasskeyEnrollmentService = {
    create: vi.fn(async () => enrollment),
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api/v1",
    createAuthRoutes(
      new AuthController(
        { login: vi.fn() } satisfies IAuthService,
        { request: vi.fn(), verify: vi.fn() } satisfies IAccountEmailVerificationService,
        {
          createRegistrationOptions: vi.fn(),
          verifyRegistration: vi.fn(),
        } satisfies ISignupPasskeyRegistrationService,
        undefined,
        undefined,
        localEnrollmentService,
      ),
    ),
  );

  let server: Server;
  let baseUrl: string;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        process.env.CALIBRATE_E2E = "1";
        process.env.NODE_ENV = "test";
        process.env.WEBAUTHN_ORIGIN = "http://localhost:3000";
        server = app.listen(0, "127.0.0.1", () => {
          baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
          resolve();
        });
      }),
  );

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          process.env = { ...originalEnvironment };
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  );

  it("issues the existing enrollment cookie and a public handoff on loopback", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/local-development/passkey-enrollment`, {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toMatch(/passkey-enrollment=local-enrollment-token/);
    expect(await response.json()).toEqual({
      email: "local-123@example.test",
      next: "passkey-registration",
      expiresAt: "2030-01-01T00:05:00.000Z",
    });
  });

  it("does not issue an authorization without a matching origin", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/local-development/passkey-enrollment`, {
      method: "POST",
      headers: { Origin: "http://example.test" },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(localEnrollmentService.create).toHaveBeenCalledOnce();
  });
});
