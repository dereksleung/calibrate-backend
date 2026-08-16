import type {
  CreatedLocalDevelopmentTestSession,
  CreateLocalDevelopmentTestSessionInput,
  ILocalDevelopmentTestSessionRepository,
} from "@application/ports/local-development-test-session-repository.js";

import { User } from "@domain/entities/user.js";
import { sql, type Transaction } from "kysely";
import { randomUUID } from "node:crypto";

import type { DatabaseClient, DatabaseSchema } from "../database-client.js";
import type { SelectableUser } from "../schemas/users-table.js";

const LOCAL_DEVELOPMENT_SESSION_EVENT_TYPE = "local-development-session-created";

export class PostgresLocalDevelopmentTestSessionRepository implements ILocalDevelopmentTestSessionRepository {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async createOrReuseFixtureSession(
    input: CreateLocalDevelopmentTestSessionInput,
  ): Promise<CreatedLocalDevelopmentTestSession> {
    return this.databaseClient.transaction().execute(async (trx) => {
      await this.configureTransaction(trx);

      const insertedUser = await trx
        .insertInto("users")
        .values({
          id: input.fixtureUser.id,
          email: input.fixtureUser.email,
          password_hash: input.fixtureUser.passwordHash,
          email_verified_at: input.fixtureUser.emailVerifiedAt,
          webauthn_user_handle: input.fixtureUser.webauthnUserHandle,
          tier: input.fixtureUser.tier.value,
          created_at: input.fixtureUser.createdAt.toISOString(),
          updated_at: input.fixtureUser.updatedAt.toISOString(),
        })
        .onConflict((onConflict) => onConflict.column("email").doNothing())
        .returningAll()
        .executeTakeFirst();

      const userRow =
        insertedUser ??
        (await trx
          .selectFrom("users")
          .selectAll()
          .where("email", "=", input.fixtureUser.email)
          .forUpdate()
          .executeTakeFirstOrThrow());
      const passkeyCredential = await trx
        .selectFrom("passkey_credentials")
        .select("id")
        .where("user_id", "=", userRow.id)
        .executeTakeFirst();
      const isCredentiallessFixture =
        userRow.password_hash === null &&
        userRow.email_verified_at === null &&
        userRow.webauthn_user_handle === null &&
        !passkeyCredential;

      if (!isCredentiallessFixture) {
        throw new Error("Reserved local development fixture identity is credentialed");
      }

      const user = this.mapUser(userRow);
      const familyId = randomUUID();

      await trx
        .insertInto("remembered_device_families")
        .values({
          id: familyId,
          user_id: user.id,
          created_at: input.now,
          last_used_at: input.now,
          inactivity_expires_at: input.familyInactivityExpiresAt,
          absolute_expires_at: input.familyAbsoluteExpiresAt,
          recent_passkey_authentication_at: null,
          recent_passkey_authentication_purpose: null,
          authentication_method: "local-development",
          current_refresh_generation: 0,
          revoked_at: null,
          revocation_reason: null,
        })
        .execute();

      await trx
        .insertInto("refresh_token_generations")
        .values({
          id: randomUUID(),
          family_id: familyId,
          generation: 0,
          token_digest: input.refreshTokenDigest,
          parent_generation_id: null,
          replacement_generation_id: null,
          created_at: input.now,
          expires_at: input.familyAbsoluteExpiresAt,
          consumed_at: null,
          revoked_at: null,
        })
        .execute();

      await trx
        .insertInto("sessions")
        .values({
          id: randomUUID(),
          user_id: user.id,
          token_digest: input.accessTokenDigest,
          transport: "cookie",
          mobile_platform: null,
          remembered_device_family_id: familyId,
          replaced_by_session_id: null,
          created_at: input.now,
          last_seen_at: input.now,
          inactivity_expires_at: input.accessInactivityExpiresAt,
          absolute_expires_at: input.accessAbsoluteExpiresAt,
          revoked_at: null,
          renewed_at: null,
        })
        .execute();

      await trx
        .insertInto("security_events")
        .values({
          id: randomUUID(),
          user_id: user.id,
          event_type: LOCAL_DEVELOPMENT_SESSION_EVENT_TYPE,
          created_at: input.now,
        })
        .execute();

      return {
        user,
        accessInactivityExpiresAt: input.accessInactivityExpiresAt,
        accessAbsoluteExpiresAt: input.accessAbsoluteExpiresAt,
        familyInactivityExpiresAt: input.familyInactivityExpiresAt,
        familyAbsoluteExpiresAt: input.familyAbsoluteExpiresAt,
      };
    });
  }

  private async configureTransaction(trx: Transaction<DatabaseSchema>): Promise<void> {
    await sql`set local lock_timeout = '2s'`.execute(trx);
    await sql`set local statement_timeout = '5s'`.execute(trx);
  }

  private mapUser(userRow: SelectableUser): User {
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
