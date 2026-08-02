import type { IAuthService } from "@application/services/auth-service.js";
import type { ISignupEmailVerificationService } from "@application/services/signup-email-verification-service.js";
import type { ISignupPasskeyRegistrationService } from "@application/services/signup-passkey-registration-service.js";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import {
  EnrollmentAuthorizationRequiredError,
  OriginNotAllowedError,
} from "@application/errors/passkey-registration-errors.js";
import { User } from "@domain/entities/user.js";
import express from "express";

import { AuthController } from "../../controllers/auth-controller.js";
import { createAuthRoutes } from "../auth-routes.js";

describe("passkey registration HTTP routes", () => {
  const authService: IAuthService = { login: vi.fn() };
  const signupEmailVerificationService: ISignupEmailVerificationService = {
    request: vi.fn(),
    verify: vi.fn(),
  };
  const signupPasskeyRegistrationService: ISignupPasskeyRegistrationService = {
    createRegistrationOptions: vi.fn(),
    verifyRegistration: vi.fn(),
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api/v1",
    createAuthRoutes(
      new AuthController(authService, signupEmailVerificationService, signupPasskeyRegistrationService),
    ),
  );

  let server: Server;
  let baseUrl: string;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        server = app.listen(0, "127.0.0.1", () => {
          baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
          resolve();
        });
      }),
  );

  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  it("rejects registration options when Origin is missing", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/passkeys/registration/options`, {
      method: "POST",
      headers: { Cookie: "passkey-enrollment=enrollment-token" },
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "ORIGIN_NOT_ALLOWED" });
    expect(signupPasskeyRegistrationService.createRegistrationOptions).not.toHaveBeenCalled();
  });

  it("returns registration options with no-store when enrollment and origin are valid", async () => {
    vi.mocked(signupPasskeyRegistrationService.createRegistrationOptions).mockResolvedValue({
      options: {
        challenge: "abc",
        rp: { id: "localhost", name: "Calibrate" },
        user: {
          id: "user-handle",
          name: "person@example.com",
          displayName: "person@example.com",
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      },
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/passkeys/registration/options`, {
      method: "POST",
      headers: {
        Cookie: "passkey-enrollment=enrollment-token",
        Origin: "http://localhost:3000",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      challenge: "abc",
      rp: { id: "localhost", name: "Calibrate" },
      user: {
        id: "user-handle",
        name: "person@example.com",
        displayName: "person@example.com",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    });
    expect(signupPasskeyRegistrationService.createRegistrationOptions).toHaveBeenCalledWith(
      "enrollment-token",
      "http://localhost:3000",
    );
  });

  it("clears the enrollment cookie and requires email verification when enrollment cannot start another ceremony", async () => {
    vi.mocked(signupPasskeyRegistrationService.createRegistrationOptions).mockRejectedValueOnce(
      new EnrollmentAuthorizationRequiredError(),
    );

    const response = await fetch(`${baseUrl}/api/v1/auth/passkeys/registration/options`, {
      method: "POST",
      headers: {
        Cookie: "passkey-enrollment=enrollment-token",
        Origin: "http://localhost:3000",
      },
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBeNull();
    expect(response.headers.get("set-cookie")).toMatch(/passkey-enrollment=;/);
    expect(await response.json()).toEqual({ error: "ENROLLMENT_AUTHORIZATION_REQUIRED" });
  });

  it("sets session cookies and clears enrollment on successful verification", async () => {
    const user = User.createForPasskeySignup({
      email: "person@example.com",
      webauthnUserHandle: "handle",
      emailVerifiedAt: new Date("2030-01-01T00:00:00.000Z"),
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      updatedAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    vi.mocked(signupPasskeyRegistrationService.verifyRegistration).mockResolvedValue({
      user,
      accessToken: "raw-access-token",
      refreshToken: "raw-refresh-token",
      rememberDevice: true,
      accessInactivityExpiresAt: new Date("2030-01-01T01:00:00.000Z"),
      familyInactivityExpiresAt: new Date("2030-02-01T00:00:00.000Z"),
      familyAbsoluteExpiresAt: new Date("2030-02-01T00:00:00.000Z"),
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/passkeys/registration/verify`, {
      method: "POST",
      headers: {
        Cookie: "passkey-enrollment=enrollment-token",
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        credential: {
          id: "Y3JlZGVudGlhbC1pZA",
          rawId: "Y3JlZGVudGlhbC1pZA",
          type: "public-key",
          clientExtensionResults: {},
          response: {
            clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0",
            attestationObject: "o2NmbXRkbm9uZWdhdHRTdG10",
          },
        },
        rememberDevice: true,
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const setCookie = response.headers.getSetCookie?.() ?? [];
    const cookieHeader = setCookie.join("; ");
    expect(cookieHeader).toMatch(/calibrate-access=raw-access-token/);
    expect(cookieHeader).toMatch(/calibrate-refresh=raw-refresh-token/);
    expect(cookieHeader).toMatch(/passkey-enrollment=;/);
    const body = await response.json();
    expect(body).toMatchObject({
      sessionTransport: "cookie",
      user: { email: "person@example.com" },
    });
    expect(JSON.stringify(body)).not.toContain("raw-access-token");
    expect(JSON.stringify(body)).not.toContain("raw-refresh-token");
  });

  it("maps origin failures from the application service to safe responses", async () => {
    vi.mocked(signupPasskeyRegistrationService.createRegistrationOptions).mockRejectedValue(
      new OriginNotAllowedError(),
    );

    const response = await fetch(`${baseUrl}/api/v1/auth/passkeys/registration/options`, {
      method: "POST",
      headers: {
        Cookie: "passkey-enrollment=enrollment-token",
        Origin: "http://localhost:3000",
      },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "ORIGIN_NOT_ALLOWED" });
  });
});
