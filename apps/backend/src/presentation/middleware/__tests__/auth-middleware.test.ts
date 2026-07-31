import { AuthenticationError } from "@application/errors/authentication-error.js";
import { IAccessTokenService } from "@application/ports/access-token-service.js";
import { createAuthenticationMiddleware } from "@presentation/middleware/auth-middleware.js";
import { MockedObject, vi } from "vitest";

describe("createAuthenticationMiddleware", () => {
  let mockAccessTokenService: MockedObject<IAccessTokenService>;

  beforeEach(() => {
    mockAccessTokenService = {
      issue: vi.fn(),
      verify: vi.fn(),
    } as any;
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
});
