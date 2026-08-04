import { AuthenticationError } from "@application/errors/authentication-error.js";
import { InvalidEmailVerificationCodeError } from "@application/errors/invalid-email-verification-code-error.js";
import { RateLimitError } from "@application/errors/rate-limit-error.js";
import { ServiceUnavailableError } from "@application/errors/service-unavailable-error.js";
import { IAuthService } from "@application/services/auth-service.js";
import { IPasskeyAuthenticationService } from "@application/services/passkey-authentication-service.js";
import { ISignupEmailVerificationService } from "@application/services/signup-email-verification-service.js";
import { ISignupPasskeyRegistrationService } from "@application/services/signup-passkey-registration-service.js";
import { ISessionRestorationService } from "@application/services/session-restoration-service.js";
import { AuthController } from "@controllers/auth-controller.js";
import { User } from "@domain/entities/user.js";
import { Request } from "express";
import { MockedObject, vi } from "vitest";

describe("AuthController", () => {
  let authController: AuthController;
  let mockAuthService: MockedObject<IAuthService>;
  let mockSignupEmailVerificationService: MockedObject<ISignupEmailVerificationService>;
  let mockSignupPasskeyRegistrationService: MockedObject<ISignupPasskeyRegistrationService>;
  let mockPasskeyAuthenticationService: MockedObject<IPasskeyAuthenticationService>;
  let mockSessionRestorationService: MockedObject<ISessionRestorationService>;

  const user = User.reconstitute({
    id: "user-1",
    email: "existing@example.com",
    passwordHash: "stored-hash",
    tier: "FREE",
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  });

  beforeEach(() => {
    mockAuthService = { login: vi.fn() } as MockedObject<IAuthService>;
    mockSignupEmailVerificationService = {
      request: vi.fn(),
      verify: vi.fn(),
    };
    mockSignupPasskeyRegistrationService = {
      createRegistrationOptions: vi.fn(),
      verifyRegistration: vi.fn(),
    };
    mockPasskeyAuthenticationService = {
      createAuthenticationOptions: vi.fn(),
      verifyAuthentication: vi.fn(),
    };
    mockSessionRestorationService = {
      getCurrentSession: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    };
    authController = new AuthController(
      mockAuthService,
      mockSignupEmailVerificationService,
      mockSignupPasskeyRegistrationService,
      mockPasskeyAuthenticationService,
      mockSessionRestorationService,
    );
  });

  it("revokes the current session and clears matching cookies after an allowed-origin logout", async () => {
    const req = {
      get: vi.fn((name: string) => {
        if (name === "Origin") return "http://localhost:3000";
        if (name === "Cookie") return "calibrate-access=access-token; calibrate-refresh=refresh-token";
        return undefined;
      }),
    } as unknown as Request;
    const res = { set: vi.fn(), clearCookie: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn() } as any;

    await authController.logout(req, res);

    expect(mockSessionRestorationService.logout).toHaveBeenCalledWith({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.clearCookie).toHaveBeenCalledWith(
      "calibrate-access",
      expect.objectContaining({ httpOnly: true, secure: false, sameSite: "lax", path: "/" }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      "calibrate-refresh",
      expect.objectContaining({ httpOnly: true, secure: false, sameSite: "strict", path: "/api/v1/auth/session" }),
    );
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
  });

  it("rejects an unexpected origin before reading credentials, revoking state, or clearing cookies", async () => {
    const req = { get: vi.fn((name: string) => (name === "Origin" ? "https://attacker.example" : undefined)) } as unknown as Request;
    const res = { set: vi.fn(), clearCookie: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await authController.logout(req, res);

    expect(mockSessionRestorationService.logout).not.toHaveBeenCalled();
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "ORIGIN_NOT_ALLOWED" });
  });

  it("preserves cookies when session revocation is unavailable", async () => {
    mockSessionRestorationService.logout.mockRejectedValue(new Error("database unavailable"));
    const req = {
      get: vi.fn((name: string) => {
        if (name === "Origin") return "http://localhost:3000";
        if (name === "Cookie") return "calibrate-access=access-token";
        return undefined;
      }),
    } as unknown as Request;
    const res = { set: vi.fn(), clearCookie: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await authController.logout(req, res);

    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: "SESSION_UNAVAILABLE" });
  });

  it("returns a no-store 202 response for a normalized web request", async () => {
    mockSignupEmailVerificationService.request.mockResolvedValue({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    const req = {
      body: { email: "  Person@Example.COM " },
      get: vi.fn().mockReturnValue(undefined),
      ip: "203.0.113.4",
    } as unknown as Request;
    const res = {
      set: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await authController.requestSignupEmailVerification(req, res);

    expect(mockSignupEmailVerificationService.request).toHaveBeenCalledWith({
      email: "person@example.com",
      platform: null,
      requestingIp: "203.0.113.4",
    });
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
  });

  it("issues cookie-only credentials after a verified passkey assertion", async () => {
    const passkeyUser = User.reconstitute({
      id: "user-1",
      email: "existing@example.com",
      passwordHash: null,
      emailVerifiedAt: new Date("2026-03-01T00:00:00.000Z"),
      webauthnUserHandle: "user-handle",
      tier: "FREE",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    mockPasskeyAuthenticationService.verifyAuthentication.mockResolvedValue({
      user: passkeyUser,
      accessToken: "raw-access-token",
      refreshToken: "raw-refresh-token",
      rememberDevice: false,
      accessInactivityExpiresAt: new Date(Date.now() + 30 * 60_000),
      familyInactivityExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
      familyAbsoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
    });
    const req = {
      body: {
        credential: {
          id: "Y3JlZGVudGlhbC1pZA",
          rawId: "cmF3LWNyZWRlbnRpYWwtaWQ",
          type: "public-key",
          clientExtensionResults: {},
          response: {
            authenticatorData: "authenticator-data",
            clientDataJSON: "client-data",
            signature: "c2lnbmF0dXJl",
            userHandle: "user-handle",
          },
        },
        rememberDevice: false,
      },
      get: vi.fn((name: string) => (name === "Origin" ? "http://localhost:3000" : undefined)),
      ip: "203.0.113.4",
    } as unknown as Request;
    const res = {
      set: vi.fn(),
      cookie: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await authController.verifyPasskeyAuthentication(req, res);

    expect(mockPasskeyAuthenticationService.verifyAuthentication).toHaveBeenCalledWith({
      origin: "http://localhost:3000",
      requestingIp: "203.0.113.4",
      assertion: {
        credentialId: "Y3JlZGVudGlhbC1pZA",
        rawCredentialId: "cmF3LWNyZWRlbnRpYWwtaWQ",
        authenticatorData: "authenticator-data",
        clientDataJSON: "client-data",
        signature: "c2lnbmF0dXJl",
        userHandle: "user-handle",
      },
      rememberDevice: false,
    });
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.cookie).toHaveBeenCalledWith(
      "calibrate-access",
      "raw-access-token",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: expect.any(Number) }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      "calibrate-refresh",
      "raw-refresh-token",
      expect.objectContaining({ httpOnly: true, sameSite: "strict", path: "/api/v1/auth/session" }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      user: expect.objectContaining({ email: "existing@example.com" }),
      sessionTransport: "cookie",
    });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain("raw-access-token");
    expect(JSON.stringify(res.json.mock.calls)).not.toContain("raw-refresh-token");
  });

  it("narrows a verified passkey registration credential to a WebAuthn attestation", async () => {
    mockSignupPasskeyRegistrationService.verifyRegistration.mockResolvedValue({
      user,
      accessToken: "raw-access-token",
      refreshToken: "raw-refresh-token",
      rememberDevice: true,
      accessInactivityExpiresAt: new Date(Date.now() + 30 * 60_000),
      familyInactivityExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
      familyAbsoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
    });
    const req = {
      body: {
        credential: {
          id: "Y3JlZGVudGlhbC1pZA",
          rawId: "cmF3LWNyZWRlbnRpYWwtaWQ",
          type: "public-key",
          clientExtensionResults: { ignored: true },
          authenticatorAttachment: "platform",
          response: {
            clientDataJSON: "Y2xpZW50LWRhdGE",
            attestationObject: "YXR0ZXN0YXRpb24",
            transports: ["internal"],
          },
        },
        rememberDevice: true,
      },
      get: vi.fn((name: string) => {
        if (name === "Origin") return "http://localhost:3000";
        if (name === "Cookie") return "passkey-enrollment=enrollment-token";
        return undefined;
      }),
    } as unknown as Request;
    const res = {
      set: vi.fn(),
      cookie: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await authController.verifyPasskeyRegistration(req, res);

    expect(mockSignupPasskeyRegistrationService.verifyRegistration).toHaveBeenCalledWith({
      enrollmentToken: "enrollment-token",
      origin: "http://localhost:3000",
      attestation: {
        credentialId: "Y3JlZGVudGlhbC1pZA",
        rawCredentialId: "cmF3LWNyZWRlbnRpYWwtaWQ",
        clientDataJSON: "Y2xpZW50LWRhdGE",
        attestationObject: "YXR0ZXN0YXRpb24",
        transports: ["internal"],
      },
      rememberDevice: true,
    });
  });

  it("binds a recognized native platform to the request", async () => {
    mockSignupEmailVerificationService.request.mockResolvedValue({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    const req = {
      body: { email: "person@example.com" },
      get: vi.fn((name: string) => (name === "X-App-Platform" ? "ios" : undefined)),
      ip: "203.0.113.4",
    } as unknown as Request;
    const res = {
      set: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await authController.requestSignupEmailVerification(req, res);

    expect(mockSignupEmailVerificationService.request).toHaveBeenCalledWith(
      expect.objectContaining({ platform: "ios" }),
    );
  });

  it("sets a scoped enrollment cookie while returning metadata only", async () => {
    mockSignupEmailVerificationService.verify.mockResolvedValue({
      enrollmentToken: "raw-enrollment-token",
      expiresAt: new Date("2026-07-12T12:05:00.000Z"),
    });
    const req = {
      body: { challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31", code: "012345" },
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Request;
    const res = {
      set: vi.fn(),
      cookie: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await authController.verifySignupEmailVerification(req, res);

    expect(mockSignupEmailVerificationService.verify).toHaveBeenCalledWith({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      code: "012345",
      platform: null,
    });
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.cookie).toHaveBeenCalledWith(
      "passkey-enrollment",
      "raw-enrollment-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        secure: false,
        path: "/api/v1/auth/passkeys/registration",
        maxAge: 300_000,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      next: "passkey-registration",
      expiresAt: "2026-07-12T12:05:00.000Z",
    });
  });

  it("returns the generic verification failure without issuing a cookie", async () => {
    mockSignupEmailVerificationService.verify.mockRejectedValue(new InvalidEmailVerificationCodeError());
    const req = {
      body: { challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31", code: "012345" },
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Request;
    const res = { set: vi.fn(), cookie: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await authController.verifySignupEmailVerification(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired verification code" });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it.each([
    [{ email: "not-an-email" }, undefined],
    [{ email: "person@example.com", unexpected: true }, undefined],
    [{ email: "person@example.com" }, "windows"],
  ])("rejects invalid request input", async (body, platform) => {
    const req = {
      body,
      get: vi.fn(() => platform),
      ip: "203.0.113.4",
    } as unknown as Request;
    const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await authController.requestSignupEmailVerification(req, res);

    expect(mockSignupEmailVerificationService.request).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Validation failed" });
  });

  it("fails closed when the requesting IP is unavailable", async () => {
    const req = {
      body: { email: "person@example.com" },
      get: vi.fn().mockReturnValue(undefined),
      ip: undefined,
    } as unknown as Request;
    const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await authController.requestSignupEmailVerification(req, res);

    expect(mockSignupEmailVerificationService.request).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Email verification is temporarily unavailable",
    });
  });

  it.each([
    [new RateLimitError("email bucket"), 429, "Too many verification-code requests"],
    [new ServiceUnavailableError("provider detail"), 503, "Email verification is temporarily unavailable"],
    [new Error("database detail"), 500, "Internal server error"],
  ])("returns a safe request failure", async (error, status, message) => {
    mockSignupEmailVerificationService.request.mockRejectedValue(error);
    const req = {
      body: { email: "person@example.com" },
      get: vi.fn().mockReturnValue(undefined),
      ip: "203.0.113.4",
    } as unknown as Request;
    const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await authController.requestSignupEmailVerification(req, res);

    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ error: message });
  });

  it("returns a bearer token response for valid legacy password credentials", async () => {
    mockAuthService.login.mockResolvedValue({
      accessToken: "jwt-token",
      expiresInSeconds: 900,
      user,
    });
    const req = {
      body: { email: "existing@example.com", password: "Password123!" },
    } as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "jwt-token",
        tokenType: "Bearer",
      }),
    );
  });

  it("rejects invalid legacy password input", async () => {
    const req = {
      body: { email: "not-an-email", password: "" },
    } as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await authController.login(req, res);

    expect(mockAuthService.login).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("maps rejected legacy password credentials to 401", async () => {
    mockAuthService.login.mockRejectedValue(new AuthenticationError("Invalid email or password"));
    const req = {
      body: { email: "existing@example.com", password: "bad-password" },
    } as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid email or password" });
  });

  it("rejects passkey registration options without a valid origin", async () => {
    const req = {
      get: vi.fn((name: string) => (name === "Origin" ? "https://evil.example" : undefined)),
    } as unknown as Request;
    const res = {
      set: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await authController.createPasskeyRegistrationOptions(req, res);

    expect(mockSignupPasskeyRegistrationService.createRegistrationOptions).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "ORIGIN_NOT_ALLOWED" });
  });

  it("returns registration options with no-store when enrollment and origin are valid", async () => {
    mockSignupPasskeyRegistrationService.createRegistrationOptions.mockResolvedValue({
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
    const req = {
      get: vi.fn((name: string) => {
        if (name === "Origin") return "http://localhost:3000";
        if (name === "Cookie") return "passkey-enrollment=enrollment-token";
        return undefined;
      }),
    } as unknown as Request;
    const res = {
      set: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await authController.createPasskeyRegistrationOptions(req, res);

    expect(mockSignupPasskeyRegistrationService.createRegistrationOptions).toHaveBeenCalledWith(
      "enrollment-token",
      "http://localhost:3000",
    );
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      challenge: "abc",
      rp: { id: "localhost", name: "Calibrate" },
      user: {
        id: "user-handle",
        name: "person@example.com",
        displayName: "person@example.com",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    });
  });
});
