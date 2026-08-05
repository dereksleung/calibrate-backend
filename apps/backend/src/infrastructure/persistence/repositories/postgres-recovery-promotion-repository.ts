import type { IRecoveryPromotionRepository } from "@application/services/recovery-promotion-service.js";

import { PasskeyAuthenticationStateConflictError } from "@application/errors/passkey-authentication-errors.js";
import { User } from "@domain/entities/user.js";
import { randomUUID } from "node:crypto";

import type { DatabaseClient } from "../database-client.js";

const PURPOSE = "account-recovery-promotion";
const CHALLENGE_LIFETIME_MS = 5 * 60_000;

export class PostgresRecoveryPromotionRepository implements IRecoveryPromotionRepository {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async preparePromotion(input: {
    accessTokenDigest: string;
    challengeDigest: string;
    rawChallenge: string;
    now: Date;
  }) {
    return this.databaseClient.transaction().execute(async (trx) => {
      const session = await trx
        .selectFrom("sessions as session")
        .innerJoin("remembered_device_families as family", "family.id", "session.remembered_device_family_id")
        .innerJoin("account_recoveries as recovery", "recovery.id", "family.recovery_id")
        .innerJoin("passkey_credentials as credential", "credential.id", "recovery.provisional_passkey_id")
        .select([
          "session.id",
          "recovery.id as recovery_id",
          "recovery.restriction_ends_at",
          "credential.credential_id",
          "credential.transports",
        ])
        .where("session.token_digest", "=", input.accessTokenDigest)
        .where("session.revoked_at", "is", null)
        .where("session.replaced_by_session_id", "is", null)
        .where("session.inactivity_expires_at", ">", input.now)
        .where("session.absolute_expires_at", ">", input.now)
        .where("family.revoked_at", "is", null)
        .where("recovery.promoted_at", "is", null)
        .where("recovery.cancelled_at", "is", null)
        .where("recovery.replaced_at", "is", null)
        .where("credential.revoked_at", "is", null)
        .forUpdate()
        .executeTakeFirst();
      if (!session || session.restriction_ends_at > input.now)
        throw new PasskeyAuthenticationStateConflictError();
      await trx
        .updateTable("webauthn_challenges")
        .set({ invalidated_at: input.now })
        .where("recovery_id", "=", session.recovery_id)
        .where("purpose", "=", PURPOSE)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .execute();
      const expiresAt = new Date(input.now.getTime() + CHALLENGE_LIFETIME_MS);
      await trx
        .insertInto("webauthn_challenges")
        .values({
          id: randomUUID(),
          enrollment_authorization_id: null,
          account_access_authorization_id: null,
          recovery_registration_authorization_id: null,
          recovery_id: session.recovery_id,
          purpose: PURPOSE,
          challenge_digest: input.challengeDigest,
          attempt_count: 0,
          max_attempts: 5,
          created_at: input.now,
          expires_at: expiresAt,
          consumed_at: null,
          invalidated_at: null,
        })
        .execute();
      return {
        rawChallenge: input.rawChallenge,
        expiresAt,
        allowCredentials: [{ id: session.credential_id, transports: session.transports }],
      };
    });
  }

  async findActivePromotion(input: {
    accessTokenDigest: string;
    challengeDigest: string;
    credentialId: string;
    now: Date;
  }) {
    const row = await this.databaseClient
      .selectFrom("sessions as session")
      .innerJoin("remembered_device_families as family", "family.id", "session.remembered_device_family_id")
      .innerJoin("account_recoveries as recovery", "recovery.id", "family.recovery_id")
      .innerJoin("webauthn_challenges as challenge", "challenge.recovery_id", "recovery.id")
      .innerJoin("passkey_credentials as credential", "credential.id", "recovery.provisional_passkey_id")
      .innerJoin("users as user", "user.id", "session.user_id")
      .select([
        "challenge.id as challenge_id",
        "user.webauthn_user_handle",
        "credential.credential_id",
        "credential.public_key",
        "credential.signature_counter",
        "credential.transports",
        "credential.backup_eligible",
        "credential.backup_state",
      ])
      .where("session.token_digest", "=", input.accessTokenDigest)
      .where("session.revoked_at", "is", null)
      .where("session.replaced_by_session_id", "is", null)
      .where("family.revoked_at", "is", null)
      .where("challenge.challenge_digest", "=", input.challengeDigest)
      .where("challenge.purpose", "=", PURPOSE)
      .where("challenge.consumed_at", "is", null)
      .where("challenge.invalidated_at", "is", null)
      .where("challenge.expires_at", ">", input.now)
      .where("credential.credential_id", "=", input.credentialId)
      .where("credential.revoked_at", "is", null)
      .where("recovery.restriction_ends_at", "<=", input.now)
      .where("recovery.promoted_at", "is", null)
      .where("recovery.cancelled_at", "is", null)
      .where("recovery.replaced_at", "is", null)
      .executeTakeFirst();
    if (!row?.webauthn_user_handle) return null;
    return {
      challengeId: row.challenge_id,
      userHandle: row.webauthn_user_handle,
      credentialId: row.credential_id,
      publicKey: new Uint8Array(row.public_key),
      signatureCounter: Number(row.signature_counter),
      transports: row.transports,
      backupEligible: row.backup_eligible,
      backupState: row.backup_state,
    };
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

  async completePromotion(input: {
    accessTokenDigest: string;
    challengeDigest: string;
    credentialId: string;
    newCounter: number;
    backupState: boolean;
    accessTokenDigestNew: string;
    refreshTokenDigest: string;
    now: Date;
    accessInactivityExpiresAt: Date;
    accessAbsoluteExpiresAt: Date;
    familyInactivityExpiresAt: Date;
    familyAbsoluteExpiresAt: Date;
  }) {
    return this.databaseClient.transaction().execute(async (trx) => {
      const session = await trx
        .selectFrom("sessions as session")
        .innerJoin("remembered_device_families as family", "family.id", "session.remembered_device_family_id")
        .innerJoin("account_recoveries as recovery", "recovery.id", "family.recovery_id")
        .innerJoin("passkey_credentials as credential", "credential.id", "recovery.provisional_passkey_id")
        .innerJoin("users as user", "user.id", "session.user_id")
        .select([
          "session.user_id",
          "recovery.id as recovery_id",
          "credential.id as credential_id",
          "user.email",
          "user.password_hash",
          "user.email_verified_at",
          "user.webauthn_user_handle",
          "user.tier",
          "user.created_at",
          "user.updated_at",
        ])
        .where("session.token_digest", "=", input.accessTokenDigest)
        .where("session.revoked_at", "is", null)
        .where("family.revoked_at", "is", null)
        .where("recovery.restriction_ends_at", "<=", input.now)
        .where("recovery.promoted_at", "is", null)
        .where("credential.credential_id", "=", input.credentialId)
        .forUpdate()
        .executeTakeFirst();
      if (!session) throw new PasskeyAuthenticationStateConflictError();
      const challenge = await trx
        .selectFrom("webauthn_challenges")
        .select("id")
        .where("recovery_id", "=", session.recovery_id)
        .where("purpose", "=", PURPOSE)
        .where("challenge_digest", "=", input.challengeDigest)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .where("expires_at", ">", input.now)
        .forUpdate()
        .executeTakeFirst();
      if (!challenge) throw new PasskeyAuthenticationStateConflictError();
      await trx
        .updateTable("webauthn_challenges")
        .set({ consumed_at: input.now })
        .where("id", "=", challenge.id)
        .execute();
      await trx
        .updateTable("passkey_credentials")
        .set({
          trust_state: "trusted",
          recovery_id: null,
          signature_counter: BigInt(input.newCounter),
          backup_state: input.backupState,
          last_used_at: input.now,
        })
        .where("id", "=", session.credential_id)
        .execute();
      await trx
        .updateTable("account_recoveries")
        .set({ promoted_at: input.now, terminal_reason: "promoted" })
        .where("id", "=", session.recovery_id)
        .execute();
      await trx
        .updateTable("sessions")
        .set({ revoked_at: input.now })
        .where("user_id", "=", session.user_id)
        .where("revoked_at", "is", null)
        .execute();
      await trx
        .updateTable("remembered_device_families")
        .set({ revoked_at: input.now, revocation_reason: "recovery-promoted" })
        .where("user_id", "=", session.user_id)
        .where("revoked_at", "is", null)
        .execute();
      const familyId = randomUUID();
      await trx
        .insertInto("remembered_device_families")
        .values({
          id: familyId,
          user_id: session.user_id,
          created_at: input.now,
          last_used_at: input.now,
          inactivity_expires_at: input.familyInactivityExpiresAt,
          absolute_expires_at: input.familyAbsoluteExpiresAt,
          recent_passkey_authentication_at: input.now,
          recent_passkey_authentication_purpose: PURPOSE,
          recent_passkey_authentication_credential_id: session.credential_id,
          recovery_id: null,
          recovery_restriction_ends_at: null,
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
          user_id: session.user_id,
          token_digest: input.accessTokenDigestNew,
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
          user_id: session.user_id,
          event_type: "account-recovery-promoted",
          created_at: input.now,
        })
        .execute();
      return {
        user: User.reconstitute({
          id: session.user_id,
          email: session.email,
          passwordHash: session.password_hash,
          emailVerifiedAt: session.email_verified_at,
          webauthnUserHandle: session.webauthn_user_handle,
          tier: session.tier,
          createdAt: new Date(session.created_at),
          updatedAt: new Date(session.updated_at),
        }),
      };
    });
  }
}
