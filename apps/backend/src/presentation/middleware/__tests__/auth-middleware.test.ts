import { AuthenticationError } from "@application/errors/authentication-error.js";
import { IAccessSessionRepository } from "@application/ports/access-session-repository.js";
import { IAccessTokenService } from "@application/ports/access-token-service.js";
import { IClock } from "@application/ports/clock.js";
import { createAuthenticationMiddleware } from "@presentation/middleware/auth-middleware.js";
import { MockedObject, vi } from "vitest";

describe("createAuthenticationMiddleware", () => {
  let mockAccessTokenService: MockedObject<IAccessTokenService>;
  let mockAccessSessionRepository: MockedObject<IAccessSessionRepository>;
  let mockClock: IClock;

  beforeEach(() => {
    mockAccessTokenService = {
      issue: vi.fn(),
      verify: vi.fn(),
    } as any;
    mockAccessSessionRepository = {
      findActiveUserIdByTokenDigest: vi.fn(),
      findSecurityStateByTokenDigest: vi.fn(),
    };
    mockClock = { now: () => new Date("2026-07-31T12:00:00.000Z") };
  });

  it("should return 401 when the Authorization header is missing", async () => {
    const middleware = createAuthenticationMiddleware(mockAccessTokenService);
    const req = {
      get: vi.fn().mockReturnValue(undefined),
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Authentication required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 when token verification fails", async () => {
    const middleware = createAuthenticationMiddleware(mockAccessTokenService);
    const req = {
      get: vi.fn().mockReturnValue("Bearer invalid-token"),
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    mockAccessTokenService.verify.mockRejectedValue(new AuthenticationError("Invalid or expired token"));

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should attach req.auth and call next for a valid bearer token", async () => {
    const middleware = createAuthenticationMiddleware(mockAccessTokenService);
    const req = {
      get: vi.fn().mockReturnValue("Bearer valid-token"),
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    mockAccessTokenService.verify.mockResolvedValue({ userId: "user-1" });

    await middleware(req, res, next);

    expect(req.auth).toEqual({ userId: "user-1" });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should authenticate using the access cookie when bearer auth is absent", async () => {
    const middleware = createAuthenticationMiddleware(
      mockAccessTokenService,
      mockAccessSessionRepository,
      mockClock,
    );
    const req = {
      get: vi.fn((name: string) => {
        if (name === "Authorization") return undefined;
        if (name === "Cookie") return "calibrate-access=opaque-access-token";
        return undefined;
      }),
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    mockAccessSessionRepository.findActiveUserIdByTokenDigest.mockResolvedValue("user-from-cookie");

    await middleware(req, res, next);

    expect(mockAccessSessionRepository.findActiveUserIdByTokenDigest).toHaveBeenCalled();
    expect(req.auth).toEqual({ userId: "user-from-cookie" });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
