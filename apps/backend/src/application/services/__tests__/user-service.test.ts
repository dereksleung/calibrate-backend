import { IPasswordHasher } from "@application/ports/password-hasher.js";
import { IUserRepository } from "@application/ports/user-repository.js";
import { UserServiceImpl } from "@application/services/user-service.js";
import { User } from "@domain/entities/user.js";
import { BusinessLogicError } from "@domain/errors/business-logic-error.js";
import { MockedObject, vi } from "vitest";

describe("UserServiceImpl", () => {
  let userService: UserServiceImpl;
  let mockPasswordHasher: MockedObject<IPasswordHasher>;
  let mockUserRepository: MockedObject<IUserRepository>;

  beforeEach(() => {
    mockPasswordHasher = {
      hash: vi.fn(),
      verify: vi.fn(),
    } as any;

    mockUserRepository = {
      findById: vi.fn(),
      save: vi.fn(),
      findByEmail: vi.fn(),
    } as any;

    userService = new UserServiceImpl(mockPasswordHasher, mockUserRepository);
  });

  describe("createUser", () => {
    it("should create and persist a new user when the email is available", async () => {
      const persistedUser = User.reconstitute({
        id: "user-1",
        email: "new-user@example.com",
        passwordHash: "persisted-hash",
        tier: "FREE",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      });

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockPasswordHasher.hash.mockResolvedValue("hashed-password");
      mockUserRepository.save.mockResolvedValue(persistedUser);

      const result = await userService.createUser({
        email: "new-user@example.com",
        password: "plain-password",
      });

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith("new-user@example.com");
      expect(mockPasswordHasher.hash).toHaveBeenCalledWith("plain-password");
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);

      const createdUser = mockUserRepository.save.mock.calls[0]?.[0];
      expect(createdUser).toBeInstanceOf(User);
      expect(createdUser.email).toBe("new-user@example.com");
      expect(createdUser.passwordHash).toBe("hashed-password");

      expect(result).toBe(persistedUser);
    });

    it("should throw a BusinessLogicError when a user with the same email already exists", async () => {
      const existingUser = User.reconstitute({
        id: "existing-user-id",
        email: "existing@example.com",
        passwordHash: "stored-hash",
        tier: "FREE",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      });

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      const createUserPromise = userService.createUser({
        email: "existing@example.com",
        password: "plain-password",
      });

      await expect(createUserPromise).rejects.toThrow(BusinessLogicError);
      await expect(createUserPromise).rejects.toThrow("User already exists");

      expect(mockPasswordHasher.hash).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("should propagate errors thrown by dependencies", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockPasswordHasher.hash.mockRejectedValue(new Error("Hashing service unavailable"));

      await expect(
        userService.createUser({
          email: "new-user@example.com",
          password: "plain-password",
        }),
      ).rejects.toThrow("Hashing service unavailable");

      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });
});
