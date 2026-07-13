import { AuthenticationError } from "@application";
import { User } from "@domain";
import { AuthController } from "@presentation";
import { IAuthService, IEmailOtpService } from "@services";
import { Request } from "express";
import { MockedObject, vi } from "vitest";

describe("AuthController", () => {
  let authController: AuthController;
  let mockAuthService: MockedObject<IAuthService>;
  let mockEmailOtpService: MockedObject<IEmailOtpService>;

  const user = User.reconstitute({
    id: "user-1",
    email: "existing@example.com",
    passwordHash: "stored-hash",
    tier: "FREE",
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  });

  beforeEach(() => {
    mockAuthService = {
      login: vi.fn(),
    } as any;
    mockEmailOtpService = {
      request: vi.fn(),
      verify: vi.fn(),
    } as any;

    authController = new AuthController(mockAuthService, mockEmailOtpService, {
      webOrigin: "http://localhost:3000",
      sessionCookie: { name: "calibrate_session", secure: false },
    });
  });

  it("returns 202 for a web email OTP request", async () => {
    mockEmailOtpService.request.mockResolvedValue({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    const req = {
      body: { email: "person@example.com" },
      get: vi.fn().mockReturnValue(undefined),
      ip: "203.0.113.4",
    } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await authController.requestEmailOtp(req, res);

    expect(mockEmailOtpService.request).toHaveBeenCalledWith({
      email: "person@example.com",
      platform: null,
      requestingIp: "203.0.113.4",
    });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
  });

  it("rejects an unknown app platform", async () => {
    const req = {
      body: { email: "person@example.com" },
      get: vi.fn().mockReturnValue("windows"),
    } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await authController.requestEmailOtp(req, res);

    expect(mockEmailOtpService.request).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("sets a persistent HttpOnly cookie without exposing the web session token", async () => {
    mockEmailOtpService.verify.mockResolvedValue({
      user,
      sessionTransport: "cookie",
      sessionToken: "opaque-secret-token",
      expiresAt: new Date("2026-08-11T12:00:00.000Z"),
    });
    const req = {
      body: { challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31", code: "123456" },
      get: vi.fn((name: string) => (name === "Origin" ? "http://localhost:3000" : undefined)),
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      cookie: vi.fn(),
      set: vi.fn(),
    } as any;

    await authController.verifyEmailOtp(req, res);

    expect(res.cookie).toHaveBeenCalledWith("calibrate_session", "opaque-secret-token", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      expires: new Date("2026-08-11T12:00:00.000Z"),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.json).toHaveBeenCalledWith({
      sessionTransport: "cookie",
      user: {
        id: "user-1",
        email: "existing@example.com",
        tier: "FREE",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    });
  });

  it("rejects missing or unexpected origins before web verification", async () => {
    for (const origin of [undefined, "null", "https://evil.example"]) {
      const req = {
        body: { challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31", code: "123456" },
        get: vi.fn((name: string) => (name === "Origin" ? origin : undefined)),
      } as unknown as Request;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

      await authController.verifyEmailOtp(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    }
    expect(mockEmailOtpService.verify).not.toHaveBeenCalled();
  });

  it("returns the opaque token for mobile without requiring Origin or setting a cookie", async () => {
    mockEmailOtpService.verify.mockResolvedValue({
      user,
      sessionTransport: "bearer",
      sessionToken: "opaque-mobile-session-token-with-more-than-43-characters",
      expiresAt: new Date("2026-08-11T12:00:00.000Z"),
    });
    const req = {
      body: { challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31", code: "123456" },
      get: vi.fn((name: string) => (name === "X-App-Platform" ? "ios" : undefined)),
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      cookie: vi.fn(),
      set: vi.fn(),
    } as any;

    await authController.verifyEmailOtp(req, res);

    expect(mockEmailOtpService.verify).toHaveBeenCalledWith({
      challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31",
      code: "123456",
      platform: "ios",
    });
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionTransport: "bearer",
        sessionToken: "opaque-mobile-session-token-with-more-than-43-characters",
        expiresAt: "2026-08-11T12:00:00.000Z",
      }),
    );
  });

  it("rejects malformed verification input and unknown mobile platforms", async () => {
    const requests = [
      {
        body: { challengeId: "not-a-uuid", code: "123456" },
        get: vi.fn().mockReturnValue(undefined),
      },
      {
        body: { challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31", code: "12345" },
        get: vi.fn().mockReturnValue(undefined),
      },
      {
        body: { challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31", code: "123456" },
        get: vi.fn((name: string) => (name === "X-App-Platform" ? "windows" : undefined)),
      },
    ];

    for (const request of requests) {
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
      await authController.verifyEmailOtp(request as unknown as Request, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(mockEmailOtpService.verify).not.toHaveBeenCalled();
  });

  it("returns one generic unauthorized response for failed verification", async () => {
    mockEmailOtpService.verify.mockRejectedValue(new AuthenticationError("Invalid or expired code"));
    const req = {
      body: { challengeId: "d9428888-122b-4e2b-9c24-2dc8442eaa31", code: "123456" },
      get: vi.fn((name: string) => (name === "Origin" ? "http://localhost:3000" : undefined)),
    } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await authController.verifyEmailOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired code" });
  });

  it("should return a bearer token response for valid credentials", async () => {
    mockAuthService.login.mockResolvedValue({
      accessToken: "jwt-token",
      expiresInSeconds: 900,
      user,
    });

    const req = {
      body: {
        email: "existing@example.com",
        password: "Password123!",
      },
    } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await authController.login(req, res);

    expect(mockAuthService.login).toHaveBeenCalledWith({
      email: "existing@example.com",
      password: "Password123!",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      accessToken: "jwt-token",
      tokenType: "Bearer",
      expiresIn: 900,
      user: {
        id: "user-1",
        email: "existing@example.com",
        tier: "FREE",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    });
  });

  it("should return 400 for invalid request bodies", async () => {
    const req = {
      body: {
        email: "not-an-email",
        password: "",
      },
    } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await authController.login(req, res);

    expect(mockAuthService.login).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should return 401 when the auth service rejects credentials", async () => {
    mockAuthService.login.mockRejectedValue(new AuthenticationError("Invalid email or password"));

    const req = {
      body: {
        email: "existing@example.com",
        password: "bad-password",
      },
    } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid email or password" });
  });
});
