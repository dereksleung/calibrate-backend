import { HashingError } from "@application/errors/hashing-error.js";
import { IPasswordHasher } from "@application/ports/password-hasher.js";
import argon2 from "argon2";

export class Argon2PasswordHasher implements IPasswordHasher {
  async hash(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      type: argon2.argon2id,
      });
    } catch (_error) {
      // TODO: Add logging of particular infra error for ops monitoring
      
      // Translate error of particular infra library to application-level error
      throw new HashingError("Failed to hash password");
    }
  }

  async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (_error) {
      // TODO: Add logging of particular infra error for ops monitoring

      // Translate error of particular infra library to application-level error
      throw new HashingError("Failed to verify password hash");
    }
  }
}
