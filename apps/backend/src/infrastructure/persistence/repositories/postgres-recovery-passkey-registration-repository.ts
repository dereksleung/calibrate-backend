import type { IRecoveryPasskeyRegistrationRepository } from "@application/services/recovery-passkey-registration-service.js";

import { EnrollmentAuthorizationRequiredError } from "@application/errors/passkey-registration-errors.js";
import { PasskeyRegistrationStateConflictError } from "@application/errors/passkey-registration-errors.js";
import { User } from "@domain/entities/user.js";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";

import type { DatabaseClient } from "../database-client.js";

const PURPOSE = "account-recovery-passkey-registration";
const RECOVERY_STARTED_EVENT = "account-recovery-started";

export class PostgresRecoveryPasskeyRegistrationRepository implements IRecoveryPasskeyRegistrationRepository {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async prepareRegistration(input: {
    recoveryRegistrationTokenDigest: string;
    rawChallenge: string;
    challengeDigest: string;
    now: Date;
  }): Promise<{
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
        .select([
          "authorization.id",
          "authorization.user_id",
          "authorization.expires_at",
          "user.email",
          "user.webauthn_user_handle",
        ])
        .where("authorization.token_digest", "=", input.recoveryRegistrationTokenDigest)
        .where("authorization.client_binding", "=", "cookie")
        .where("authorization.consumed_at", "is", null)
        .where("authorization.invalidated_at", "is", null)
        .where("authorization.expires_at", ">", input.now)
        .forUpdate()
        .executeTakeFirst();
      if (!authorization?.webauthn_user_handle) throw new EnrollmentAuthorizationRequiredError();
      const credentials = await trx
        .selectFrom("passkey_credentials")
        .select(["credential_id", "transports"])
        .where("user_id", "=", authorization.user_id)
        .where("revoked_at", "is", null)
        .execute();
      await trx
        .updateTable("webauthn_challenges")
        .set({ invalidated_at: input.now })
        .where("recovery_registration_authorization_id", "=", authorization.id)
        .where("purpose", "=", PURPOSE)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .execute();
      await trx
        .insertInto("webauthn_challenges")
        .values({
          id: randomUUID(),
          enrollment_authorization_id: null,
          account_access_authorization_id: null,
          recovery_registration_authorization_id: authorization.id,
          recovery_id: null,
          purpose: PURPOSE,
          challenge_digest: input.challengeDigest,
          attempt_count: 0,
          max_attempts: 5,
          created_at: input.now,
          expires_at: authorization.expires_at,
          consumed_at: null,
          invalidated_at: null,
        })
        .execute();
      return {
        userHandle: authorization.webauthn_user_handle,
        email: authorization.email,
        rawChallenge: input.rawChallenge,
        excludeCredentials: credentials.map((credential) => ({
          id: credential.credential_id,
          transports: credential.transports,
        })),
      };
    });
  }

  async findActiveChallenge(input: {
    recoveryRegistrationTokenDigest: string;
    challengeDigest: string;
    now: Date;
  }): Promise<{ challengeId: string } | null> {
    const challenge = await this.databaseClient
      .selectFrom("webauthn_challenges as challenge")
      .innerJoin(
        "recovery_registration_authorizations as authorization",
        "authorization.id",
        "challenge.recovery_registration_authorization_id",
      )
      .select("challenge.id")
      .where("authorization.token_digest", "=", input.recoveryRegistrationTokenDigest)
      .where("authorization.client_binding", "=", "cookie")
      .where("authorization.consumed_at", "is", null)
      .where("authorization.invalidated_at", "is", null)
      .where("authorization.expires_at", ">", input.now)
      .where("challenge.challenge_digest", "=", input.challengeDigest)
      .where("challenge.purpose", "=", PURPOSE)
      .where("challenge.consumed_at", "is", null)
      .where("challenge.invalidated_at", "is", null)
      .where("challenge.expires_at", ">", input.now)
      .whereRef("challenge.attempt_count", "<", "challenge.max_attempts")
      .executeTakeFirst();
    return challenge ? { challengeId: challenge.id } : null;
  }

  async recordFailedVerificationAttempt(input: { challengeId: string; now: Date }): Promise<void> {
    await this.databaseClient
      .updateTable("webauthn_challenges")
      .set((eb) => ({ attempt_count: eb("attempt_count", "+", 1) }))
      .where("id", "=", input.challengeId)
      .where("consumed_at", "is", null)
      .where("invalidated_at", "is", null)
      .execute();
  }

  async completeRegistration(input: {
    recoveryRegistrationTokenDigest: string;
    challengeDigest: string;
    now: Date;
    restrictionEndsAt: Date;
    passkey: {
      credentialId: string;
      publicKey: Uint8Array;
      algorithm: number;
      transports: string[];
      signatureCounter: number;
      aaguid: string;
      backupEligible: boolean;
      backupState: boolean;
    };
    accessTokenDigest: string;
    refreshTokenDigest: string;
    accessInactivityExpiresAt: Date;
    accessAbsoluteExpiresAt: Date;
    familyInactivityExpiresAt: Date;
    familyAbsoluteExpiresAt: Date;
    securityEventId: string;
  }): Promise<{
    user: User;
    accessInactivityExpiresAt: Date;
    familyInactivityExpiresAt: Date;
    familyAbsoluteExpiresAt: Date;
  }> {
    return this.databaseClient.transaction().execute(async (trx) => {
      await sql`set local lock_timeout = '2s'`.execute(trx);
      const authorization = await trx
        .selectFrom("recovery_registration_authorizations as authorization")
        .innerJoin("users as user", "user.id", "authorization.user_id")
        .select([
          "authorization.id",
          "authorization.user_id",
          "authorization.replaces_recovery_id",
          "user.email",
          "user.password_hash",
          "user.email_verified_at",
          "user.webauthn_user_handle",
          "user.tier",
          "user.created_at",
          "user.updated_at",
        ])
        .where("authorization.token_digest", "=", input.recoveryRegistrationTokenDigest)
        .where("authorization.client_binding", "=", "cookie")
        .where("authorization.consumed_at", "is", null)
        .where("authorization.invalidated_at", "is", null)
        .where("authorization.expires_at", ">", input.now)
        .forUpdate()
        .executeTakeFirst();
      if (!authorization) throw new EnrollmentAuthorizationRequiredError();
      const challenge = await trx
        .selectFrom("webauthn_challenges")
        .select("id")
        .where("recovery_registration_authorization_id", "=", authorization.id)
        .where("challenge_digest", "=", input.challengeDigest)
        .where("purpose", "=", PURPOSE)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .where("expires_at", ">", input.now)
        .whereRef("attempt_count", "<", "max_attempts")
        .forUpdate()
        .executeTakeFirst();
      if (!challenge) throw new PasskeyRegistrationStateConflictError();
      const duplicate = await trx
        .selectFrom("passkey_credentials")
        .select("id")
        .where("credential_id", "=", input.passkey.credentialId)
        .executeTakeFirst();
      if (duplicate) throw new PasskeyRegistrationStateConflictError();

      const existingRecovery = await trx
        .selectFrom("account_recoveries")
        .select("id")
        .where("user_id", "=", authorization.user_id)
        .where("promoted_at", "is", null)
        .where("cancelled_at", "is", null)
        .where("replaced_at", "is", null)
        .forUpdate()
        .executeTakeFirst();
      if (
        (authorization.replaces_recovery_id === null && existingRecovery) ||
        (authorization.replaces_recovery_id !== null &&
          existingRecovery?.id !== authorization.replaces_recovery_id)
      ) {
        throw new PasskeyRegistrationStateConflictError();
      }

      const consumedChallenge = await trx
        .updateTable("webauthn_challenges")
        .set({ consumed_at: input.now })
        .where("id", "=", challenge.id)
        .where("consumed_at", "is", null)
        .executeTakeFirst();
      const consumedAuthorization = await trx
        .updateTable("recovery_registration_authorizations")
        .set({ consumed_at: input.now })
        .where("id", "=", authorization.id)
        .where("consumed_at", "is", null)
        .executeTakeFirst();
      if (
        Number(consumedChallenge.numUpdatedRows) !== 1 ||
        Number(consumedAuthorization.numUpdatedRows) !== 1
      )
        throw new PasskeyRegistrationStateConflictError();

      if (authorization.replaces_recovery_id) {
        await trx
          .updateTable("passkey_credentials")
          .set({ revoked_at: input.now })
          .where("recovery_id", "=", authorization.replaces_recovery_id)
          .where("revoked_at", "is", null)
          .execute();
        await trx
          .updateTable("sessions")
          .set({ revoked_at: input.now })
          .where("remembered_device_family_id", "in", (eb) =>
            eb
              .selectFrom("remembered_device_families")
              .select("id")
              .where("recovery_id", "=", authorization.replaces_recovery_id),
          )
          .where("revoked_at", "is", null)
          .execute();
        await trx
          .updateTable("remembered_device_families")
          .set({ revoked_at: input.now, revocation_reason: "recovery-replaced" })
          .where("recovery_id", "=", authorization.replaces_recovery_id)
          .where("revoked_at", "is", null)
          .execute();
        await trx
          .updateTable("account_recoveries")
          .set({ replaced_at: input.now, terminal_reason: "replaced" })
          .where("id", "=", authorization.replaces_recovery_id)
          .execute();
      }

      const recoveryId = randomUUID();
      const passkeyId = randomUUID();
      await trx
        .insertInto("account_recoveries")
        .values({
          id: recoveryId,
          user_id: authorization.user_id,
          provisional_passkey_id: null,
          registered_at: input.now,
          restriction_ends_at: input.restrictionEndsAt,
          promoted_at: null,
          cancelled_at: null,
          replaced_at: null,
          terminal_reason: null,
        })
        .execute();
      await trx
        .insertInto("passkey_credentials")
        .values({
          id: passkeyId,
          user_id: authorization.user_id,
          credential_id: input.passkey.credentialId,
          public_key: Buffer.from(input.passkey.publicKey),
          algorithm: input.passkey.algorithm,
          transports: input.passkey.transports,
          signature_counter: BigInt(input.passkey.signatureCounter),
          aaguid: input.passkey.aaguid,
          backup_eligible: input.passkey.backupEligible,
          backup_state: input.passkey.backupState,
          recovery_id: recoveryId,
          trust_state: "provisional",
          created_at: input.now,
          last_used_at: null,
          revoked_at: null,
        })
        .execute();
      await trx
        .updateTable("account_recoveries")
        .set({ provisional_passkey_id: passkeyId })
        .where("id", "=", recoveryId)
        .execute();

      const familyId = randomUUID();
      await trx
        .insertInto("remembered_device_families")
        .values({
          id: familyId,
          user_id: authorization.user_id,
          created_at: input.now,
          last_used_at: input.now,
          inactivity_expires_at: input.familyInactivityExpiresAt,
          absolute_expires_at: input.familyAbsoluteExpiresAt,
          recent_passkey_authentication_at: input.now,
          recent_passkey_authentication_purpose: "account-recovery-registration",
          recent_passkey_authentication_credential_id: passkeyId,
          recovery_id: recoveryId,
          recovery_restriction_ends_at: input.restrictionEndsAt,
          authentication_method: "passkey",
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
          user_id: authorization.user_id,
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
          id: input.securityEventId,
          user_id: authorization.user_id,
          event_type: RECOVERY_STARTED_EVENT,
          created_at: input.now,
        })
        .execute();
      await trx
        .insertInto("security_notification_outbox")
        .values({
          id: randomUUID(),
          security_event_id: input.securityEventId,
          user_id: authorization.user_id,
          event_type: RECOVERY_STARTED_EVENT,
          payload: {
            registeredAt: input.now.toISOString(),
            restrictionEndsAt: input.restrictionEndsAt.toISOString(),
          },
          attempt_count: 0,
          next_attempt_at: input.now,
          delivered_at: null,
          failed_at: null,
          created_at: input.now,
        })
        .execute();
      return {
        user: User.reconstitute({
          id: authorization.user_id,
          email: authorization.email,
          passwordHash: authorization.password_hash,
          emailVerifiedAt: authorization.email_verified_at,
          webauthnUserHandle: authorization.webauthn_user_handle,
          tier: authorization.tier,
          createdAt: new Date(authorization.created_at),
          updatedAt: new Date(authorization.updated_at),
        }),
        accessInactivityExpiresAt: input.accessInactivityExpiresAt,
        familyInactivityExpiresAt: input.familyInactivityExpiresAt,
        familyAbsoluteExpiresAt: input.familyAbsoluteExpiresAt,
      };
    });
  }
}
