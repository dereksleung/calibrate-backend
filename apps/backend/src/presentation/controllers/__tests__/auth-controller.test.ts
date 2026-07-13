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
    } as any;

    authController = new AuthController(mockAuthService, mockEmailOtpService);
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
