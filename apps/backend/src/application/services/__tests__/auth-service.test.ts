import {
  AccessTokenPayload,
  AuthenticationError,
  IAccessTokenService,
  IPasswordHasher,
  IUserRepository,
} from "@application";
import { User } from "@domain/entities/user.js";
import { AuthServiceImpl } from "@services";
import { MockedObject, vi } from "vitest";

describe("AuthServiceImpl", () => {
  let authService: AuthServiceImpl;
  let mockAccessTokenService: MockedObject<IAccessTokenService>;
  let mockPasswordHasher: MockedObject<IPasswordHasher>;
  let mockUserRepository: MockedObject<IUserRepository>;

  const existingUser = User.reconstitute({
    id: "user-1",
    email: "existing@example.com",
    passwordHash: "stored-hash",
    tier: "FREE",
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  });

  beforeEach(() => {
    mockAccessTokenService = {
      issue: vi.fn(),
      verify: vi.fn(),
    } as any;

    mockPasswordHasher = {
      hash: vi.fn(),
      verify: vi.fn(),
    } as any;

    mockUserRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      save: vi.fn(),
    } as any;

    authService = new AuthServiceImpl(mockPasswordHasher, mockUserRepository, mockAccessTokenService);
  });

  it("should return an access token for valid credentials", async () => {
    mockUserRepository.findByEmail.mockResolvedValue(existingUser);
    mockPasswordHasher.verify.mockResolvedValue(true);
    mockAccessTokenService.issue.mockResolvedValue({
      token: "jwt-token",
      expiresInSeconds: 900,
    });

    const result = await authService.login({
      email: "existing@example.com",
      password: "Password123!",
    });

    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith("existing@example.com");
    expect(mockPasswordHasher.verify).toHaveBeenCalledWith("Password123!", "stored-hash");
    expect(mockAccessTokenService.issue).toHaveBeenCalledWith({
      userId: "user-1",
    } satisfies AccessTokenPayload);
    expect(result).toEqual({
      accessToken: "jwt-token",
      expiresInSeconds: 900,
      user: existingUser,
    });
  });

  it("should throw AuthenticationError when the email is unknown", async () => {
    mockUserRepository.findByEmail.mockResolvedValue(null);

    await expect(
      authService.login({
        email: "missing@example.com",
        password: "Password123!",
      }),
    ).rejects.toThrow(AuthenticationError);

    expect(mockPasswordHasher.verify).not.toHaveBeenCalled();
    expect(mockAccessTokenService.issue).not.toHaveBeenCalled();
  });

  it("should throw AuthenticationError when the password is invalid", async () => {
    mockUserRepository.findByEmail.mockResolvedValue(existingUser);
    mockPasswordHasher.verify.mockResolvedValue(false);

    await expect(
      authService.login({
        email: "existing@example.com",
        password: "wrong-password",
      }),
    ).rejects.toThrow(AuthenticationError);

    expect(mockAccessTokenService.issue).not.toHaveBeenCalled();
  });
});
