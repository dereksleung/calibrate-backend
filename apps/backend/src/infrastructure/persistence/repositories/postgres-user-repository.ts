import { IUserRepository } from "@application/ports/user-repository.js";
import { User } from "@domain/entities/user.js";

import type { DatabaseClient } from "../database-client.js";

import { SelectableUser } from "../schemas/users-table.js";

export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async findById(id: string): Promise<User | null> {
    const userRow = await this.databaseClient
      .selectFrom("users")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return userRow ? this.mapRowToUser(userRow) : null;
  }

  async save(user: User): Promise<User> {
    const userRow = await this.databaseClient
      .insertInto("users")
      .values({
        id: user.id,
        email: user.email,
        password_hash: user.passwordHash,
        email_verified_at: user.emailVerifiedAt,
        webauthn_user_handle: user.webauthnUserHandle,
        tier: user.tier.value,
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString(),
      })
      .returningAll()
      .executeTakeFirst();

    if (!userRow) {
      throw new Error("Failed to create user");
    }

    return this.mapRowToUser(userRow);
  }

  async findByEmail(email: string): Promise<User | null> {
    const userRow = await this.databaseClient
      .selectFrom("users")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();

    if (!userRow) return null;

    return this.mapRowToUser(userRow);
  }

  private mapRowToUser(userRow: SelectableUser): User {
    return User.reconstitute({
      id: userRow.id,
      email: userRow.email,
      passwordHash: userRow.password_hash,
      emailVerifiedAt: userRow.email_verified_at,
      webauthnUserHandle: userRow.webauthn_user_handle,
      tier: userRow.tier,
      createdAt: new Date(userRow.created_at),
      updatedAt: new Date(userRow.updated_at),
    });
  }
}
