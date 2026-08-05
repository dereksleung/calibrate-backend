import type {
  IRecoveryRegistrationAuthorizationRepository,
  RecoveryRegistrationMode,
} from "@application/services/recovery-registration-authorization-service.js";

import {
  EnrollmentAuthorizationRequiredError,
  PasskeyRegistrationStateConflictError,
} from "@application/errors/passkey-registration-errors.js";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";

import type { DatabaseClient } from "../database-client.js";

export class PostgresRecoveryRegistrationAuthorizationRepository
  implements IRecoveryRegistrationAuthorizationRepository
{
  constructor(private readonly databaseClient: DatabaseClient) {}

  async authorize(input: {
    accountAccessTokenDigest: string;
    recoveryRegistrationTokenDigest: string;
    mode: RecoveryRegistrationMode;
    clientBinding: "cookie";
    now: Date;
    expiresAt: Date;
  }): Promise<void> {
    await this.databaseClient.transaction().execute(async (trx) => {
      await sql`set local lock_timeout = '2s'`.execute(trx);
      await sql`set local statement_timeout = '5s'`.execute(trx);
      const accountAccess = await trx
        .selectFrom("account_access_authorizations")
        .select(["id", "user_id"])
        .where("token_digest", "=", input.accountAccessTokenDigest)
        .where("client_binding", "=", input.clientBinding)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .where("expires_at", ">", input.now)
        .forUpdate()
        .executeTakeFirst();
      if (!accountAccess) throw new EnrollmentAuthorizationRequiredError();

      const activeRecovery = await trx
        .selectFrom("account_recoveries")
        .select("id")
        .where("user_id", "=", accountAccess.user_id)
        .where("promoted_at", "is", null)
        .where("cancelled_at", "is", null)
        .where("replaced_at", "is", null)
        .forUpdate()
        .executeTakeFirst();
      if ((input.mode === "create" && activeRecovery) || (input.mode === "replace-provisional" && !activeRecovery)) {
        throw new PasskeyRegistrationStateConflictError();
      }

      const consumed = await trx
        .updateTable("account_access_authorizations")
        .set({ consumed_at: input.now })
        .where("id", "=", accountAccess.id)
        .where("consumed_at", "is", null)
        .executeTakeFirst();
      if (Number(consumed.numUpdatedRows) !== 1) throw new PasskeyRegistrationStateConflictError();

      await trx
        .insertInto("recovery_registration_authorizations")
        .values({
          id: randomUUID(),
          user_id: accountAccess.user_id,
          account_access_authorization_id: accountAccess.id,
          replaces_recovery_id: activeRecovery?.id ?? null,
          token_digest: input.recoveryRegistrationTokenDigest,
          client_binding: input.clientBinding,
          created_at: input.now,
          expires_at: input.expiresAt,
          consumed_at: null,
          invalidated_at: null,
        })
        .execute();
    });
  }

  async getAccountAccessStatus(input: { accountAccessTokenDigest: string; now: Date }): Promise<{
    email: string;
    hasRegisteredPasskeys: boolean;
    activeRecovery: null | { restrictionEndsAt: Date };
    authorizationExpiresAt: Date;
  } | null> {
    const authorization = await this.databaseClient
      .selectFrom("account_access_authorizations as authorization")
      .innerJoin("users as user", "user.id", "authorization.user_id")
      .select(["authorization.user_id", "authorization.expires_at", "user.email"])
      .where("authorization.token_digest", "=", input.accountAccessTokenDigest)
      .where("authorization.client_binding", "=", "cookie")
      .where("authorization.consumed_at", "is", null)
      .where("authorization.invalidated_at", "is", null)
      .where("authorization.expires_at", ">", input.now)
      .executeTakeFirst();
    if (!authorization) return null;
    const [credential, recovery] = await Promise.all([
      this.databaseClient
        .selectFrom("passkey_credentials")
        .select("id")
        .where("user_id", "=", authorization.user_id)
        .where("revoked_at", "is", null)
        .executeTakeFirst(),
      this.databaseClient
        .selectFrom("account_recoveries")
        .select("restriction_ends_at")
        .where("user_id", "=", authorization.user_id)
        .where("promoted_at", "is", null)
        .where("cancelled_at", "is", null)
        .where("replaced_at", "is", null)
        .executeTakeFirst(),
    ]);
    return {
      email: authorization.email,
      hasRegisteredPasskeys: Boolean(credential),
      activeRecovery: recovery ? { restrictionEndsAt: recovery.restriction_ends_at } : null,
      authorizationExpiresAt: authorization.expires_at,
    };
  }
}
