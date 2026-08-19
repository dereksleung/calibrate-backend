import type { IAccountEmailVerificationService } from "@application/services/account-email-verification-service.js";
import type { IAuthService } from "@application/services/auth-service.js";
import type {
  ILocalDevelopmentPasskeyEnrollmentService,
  LocalDevelopmentPasskeyEnrollment,
} from "@application/services/local-development-passkey-enrollment-service.js";
import type {
  ILocalDevelopmentTestSessionService,
  LocalDevelopmentTestSession,
} from "@application/services/local-development-test-session-service.js";
import type { ISignupPasskeyRegistrationService } from "@application/services/signup-passkey-registration-service.js";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { User } from "@domain/entities/user.js";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, Mocked, vi } from "vitest";

import { AuthController } from "../../controllers/auth-controller.js";
import { createAuthRoutes } from "../auth-routes.js";

describe("local development auth route", () => {
  const enrollment: LocalDevelopmentPasskeyEnrollment = {
    token: "local-enrollment-token",
    email: "local-123@example.test",
    expiresAt: new Date("2030-01-01T00:05:00.000Z"),
  };
  const localEnrollmentService: ILocalDevelopmentPasskeyEnrollmentService = {
    create: vi.fn(async () => enrollment),
  };
  const localTestSession: LocalDevelopmentTestSession = {
    user: User.reconstitute({
      id: "e74942b3-78d7-48e8-bd20-dc5eba7f82ff",
      email: "local-test-session@example.test",
      passwordHash: null,
      emailVerifiedAt: null,
      webauthnUserHandle: null,
      tier: "FREE",
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      updatedAt: new Date("2030-01-01T00:00:00.000Z"),
    }),
    accessToken: "raw-access-token",
    refreshToken: "raw-refresh-token",
    rememberDevice: true,
    accessInactivityExpiresAt: new Date("2030-01-01T00:30:00.000Z"),
    accessAbsoluteExpiresAt: new Date("2030-01-01T08:00:00.000Z"),
    familyInactivityExpiresAt: new Date("2030-01-08T00:00:00.000Z"),
    familyAbsoluteExpiresAt: new Date("2030-01-31T00:00:00.000Z"),
  };
  const localTestSessionService: Mocked<ILocalDevelopmentTestSessionService> = {
    create: vi.fn(async () => localTestSession),
  };
  const sessionRestorationService = {
    getCurrentSession: vi.fn(async (accessToken: string) =>
      accessToken === localTestSession.accessToken ? localTestSession.user : null,
    ),
    refresh: vi.fn(),
    logout: vi.fn(),
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
        sessionRestorationService,
        localEnrollmentService,
        localTestSessionService,
      ),
    ),
  );

  let server: Server;
  let baseUrl: string;

  beforeAll(() => {
    vi.stubEnv("CALIBRATE_E2E", "1");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("WEBAUTHN_ORIGIN", "http://localhost:3000");

    return new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("sets normal cookies that restore an authenticated session through the cookie jar", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/local-development/test-session`, {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const setCookieHeaders = response.headers.getSetCookie();
    const cookieHeader = setCookieHeaders.map((header) => header.split(";", 1)[0]).join("; ");
    expect(setCookieHeaders).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^calibrate-access=raw-access-token;.*HttpOnly;.*SameSite=Lax/),
        expect.stringMatching(
          /^calibrate-refresh=raw-refresh-token;.*Path=\/api\/v1\/auth\/session;.*HttpOnly;.*SameSite=Strict/,
        ),
      ]),
    );

    const body = await response.json();
    expect(body).toEqual({
      user: expect.objectContaining({ email: "local-test-session@example.test" }),
      sessionTransport: "cookie",
    });
    expect(JSON.stringify(body)).not.toContain(localTestSession.accessToken);
    expect(JSON.stringify(body)).not.toContain(localTestSession.refreshToken);

    const restored = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: { Cookie: cookieHeader },
    });
    expect(restored.status).toBe(200);
    expect(await restored.json()).toEqual({
      user: expect.objectContaining({ email: "local-test-session@example.test" }),
      sessionTransport: "cookie",
    });
  });

  it("returns 404 without creating a session when Origin is absent", async () => {
    const callsBefore = localTestSessionService.create.mock.calls.length;
    const response = await fetch(`${baseUrl}/api/v1/auth/local-development/test-session`, {
      method: "POST",
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(localTestSessionService.create).toHaveBeenCalledTimes(callsBefore);
  });

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
