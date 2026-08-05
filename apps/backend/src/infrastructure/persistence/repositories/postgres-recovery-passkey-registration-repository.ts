import type { IRecoveryPasskeyRegistrationRepository } from "@application/services/recovery-passkey-registration-service.js";

import { EnrollmentAuthorizationRequiredError } from "@application/errors/passkey-registration-errors.js";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";

import type { DatabaseClient } from "../database-client.js";

const PURPOSE = "account-recovery-passkey-registration";

export class PostgresRecoveryPasskeyRegistrationRepository
  implements IRecoveryPasskeyRegistrationRepository
{
  constructor(private readonly databaseClient: DatabaseClient) {}

  async prepareRegistration(input: { recoveryRegistrationTokenDigest: string; rawChallenge: string; challengeDigest: string; now: Date }): Promise<{
    userHandle: string;
    email: string;
    rawChallenge: string;
    excludeCredentials: Array<{ id: string; transports: string[] }>;
  }> {
    return this.databaseClient.transaction().execute(async (trx) => {
      await sql`set local lock_timeout = '2s'`.execute(trx);
      const authorization = await trx
        .selectFrom("recovery_registration_authorizations as authorization")
        .innerJoin("users as user", "user.id", "authorization.user_id")
        .select(["authorization.id", "authorization.user_id", "authorization.expires_at", "user.email", "user.webauthn_user_handle"])
        .where("authorization.token_digest", "=", input.recoveryRegistrationTokenDigest)
        .where("authorization.client_binding", "=", "cookie")
        .where("authorization.consumed_at", "is", null)
        .where("authorization.invalidated_at", "is", null)
        .where("authorization.expires_at", ">", input.now)
        .forUpdate()
        .executeTakeFirst();
      if (!authorization?.webauthn_user_handle) throw new EnrollmentAuthorizationRequiredError();
      const credentials = await trx.selectFrom("passkey_credentials").select(["credential_id", "transports"]).where("user_id", "=", authorization.user_id).where("revoked_at", "is", null).execute();
      await trx.updateTable("webauthn_challenges").set({ invalidated_at: input.now }).where("recovery_registration_authorization_id", "=", authorization.id).where("purpose", "=", PURPOSE).where("consumed_at", "is", null).where("invalidated_at", "is", null).execute();
      await trx.insertInto("webauthn_challenges").values({ id: randomUUID(), enrollment_authorization_id: null, account_access_authorization_id: null, recovery_registration_authorization_id: authorization.id, recovery_id: null, purpose: PURPOSE, challenge_digest: input.challengeDigest, attempt_count: 0, max_attempts: 5, created_at: input.now, expires_at: authorization.expires_at, consumed_at: null, invalidated_at: null }).execute();
      return { userHandle: authorization.webauthn_user_handle, email: authorization.email, rawChallenge: input.rawChallenge, excludeCredentials: credentials.map((credential) => ({ id: credential.credential_id, transports: credential.transports })) };
    });
  }
}
