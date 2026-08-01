import {
  EnrollmentAuthorizationRequiredError,
  PasskeyRegistrationStateConflictError,
  PasskeyRegistrationUnavailableError,
} from "@application/errors/passkey-registration-errors.js";
import {
  type ActiveSignupRegistrationChallenge,
  type CompleteSignupPasskeyRegistrationInput,
  type CompleteSignupPasskeyRegistrationResult,
  type ISignupPasskeyRegistrationRepository,
  type PrepareSignupPasskeyRegistrationInput,
  type PreparedSignupPasskeyRegistration,
  SIGNUP_PASSKEY_REGISTRATION_PURPOSE,
} from "@application/ports/signup-passkey-registration-repository.js";
import { User } from "@domain/entities/user.js";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";

import type { DatabaseClient } from "../database-client.js";

const PASSKEY_ADDED_EVENT_TYPE = "passkey-added";

export class PostgresSignupPasskeyRegistrationRepository implements ISignupPasskeyRegistrationRepository {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async prepareRegistration(
    input: PrepareSignupPasskeyRegistrationInput,
  ): Promise<PreparedSignupPasskeyRegistration> {
    return this.databaseClient.transaction().execute(async (trx) => {
      await sql`set local lock_timeout = '2s'`.execute(trx);
      await sql`set local statement_timeout = '5s'`.execute(trx);

      const authorization = await trx
        .selectFrom("signup_enrollment_authorizations")
        .selectAll()
        .where("token_digest", "=", input.enrollmentTokenDigest)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .where("expires_at", ">", input.now)
        .forUpdate()
        .executeTakeFirst();

      if (!authorization) {
        throw new EnrollmentAuthorizationRequiredError();
      }

      const optionsCount = await trx
        .selectFrom("webauthn_challenges")
        .select(({ fn }) => fn.countAll<number>().as("count"))
        .where("enrollment_authorization_id", "=", authorization.id)
        .where("purpose", "=", SIGNUP_PASSKEY_REGISTRATION_PURPOSE)
        .executeTakeFirstOrThrow();

      if (Number(optionsCount.count) >= input.maxOptionsRequests) {
        throw new EnrollmentAuthorizationRequiredError();
      }

      let userHandle = authorization.webauthn_user_handle;
      if (userHandle === null) {
        const assigned = await trx
          .updateTable("signup_enrollment_authorizations")
          .set({ webauthn_user_handle: input.candidateUserHandle })
          .where("id", "=", authorization.id)
          .returning("webauthn_user_handle")
          .executeTakeFirst();

        if (!assigned?.webauthn_user_handle) {
          throw new PasskeyRegistrationUnavailableError();
        }
        userHandle = assigned.webauthn_user_handle;
      }

      await trx
        .updateTable("webauthn_challenges")
        .set({ invalidated_at: input.now })
        .where("enrollment_authorization_id", "=", authorization.id)
        .where("purpose", "=", SIGNUP_PASSKEY_REGISTRATION_PURPOSE)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .execute();

      const challengeId = randomUUID();
      const challengeExpiresAt = authorization.expires_at;

      await trx
        .insertInto("webauthn_challenges")
        .values({
          id: challengeId,
          enrollment_authorization_id: authorization.id,
          purpose: SIGNUP_PASSKEY_REGISTRATION_PURPOSE,
          challenge_digest: input.challengeDigest,
          attempt_count: 0,
          max_attempts: input.maxVerificationAttempts,
          created_at: input.now,
          expires_at: challengeExpiresAt,
          consumed_at: null,
          invalidated_at: null,
        })
        .execute();

      return {
        enrollmentAuthorizationId: authorization.id,
        challengeId,
        email: authorization.email,
        userHandle,
        rawChallenge: input.rawChallenge,
        challengeExpiresAt,
      };
    });
  }

  async findActiveChallenge(input: {
    enrollmentTokenDigest: string;
    challengeDigest: string;
    now: Date;
  }): Promise<ActiveSignupRegistrationChallenge | null> {
    const row = await this.databaseClient
      .selectFrom("webauthn_challenges as challenge")
      .innerJoin(
        "signup_enrollment_authorizations as authorization",
        "authorization.id",
        "challenge.enrollment_authorization_id",
      )
      .select([
        "challenge.id as challenge_id",
        "challenge.enrollment_authorization_id",
        "challenge.expires_at as challenge_expires_at",
        "challenge.attempt_count",
        "challenge.max_attempts",
        "authorization.email",
        "authorization.webauthn_user_handle",
      ])
      .where("authorization.token_digest", "=", input.enrollmentTokenDigest)
      .where("challenge.challenge_digest", "=", input.challengeDigest)
      .where("challenge.purpose", "=", SIGNUP_PASSKEY_REGISTRATION_PURPOSE)
      .where("challenge.consumed_at", "is", null)
      .where("challenge.invalidated_at", "is", null)
      .where("challenge.expires_at", ">", input.now)
      .where("authorization.consumed_at", "is", null)
      .where("authorization.invalidated_at", "is", null)
      .where("authorization.expires_at", ">", input.now)
      .executeTakeFirst();

    if (!row?.webauthn_user_handle) {
      return null;
    }

    return {
      challengeId: row.challenge_id,
      enrollmentAuthorizationId: row.enrollment_authorization_id,
      email: row.email,
      userHandle: row.webauthn_user_handle,
      challengeExpiresAt: row.challenge_expires_at,
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
    };
  }

  async recordFailedVerificationAttempt(input: { challengeId: string; now: Date }): Promise<void> {
    await this.databaseClient
      .updateTable("webauthn_challenges")
      .set((eb) => ({
        attempt_count: eb("attempt_count", "+", 1),
      }))
      .where("id", "=", input.challengeId)
      .where("consumed_at", "is", null)
      .where("invalidated_at", "is", null)
      .execute();
  }

  async completeRegistration(
    input: CompleteSignupPasskeyRegistrationInput,
    accessToken: string,
    refreshToken: string,
  ): Promise<CompleteSignupPasskeyRegistrationResult> {
    return this.databaseClient.transaction().execute(async (trx) => {
      await sql`set local lock_timeout = '2s'`.execute(trx);
      await sql`set local statement_timeout = '5s'`.execute(trx);

      const authorization = await trx
        .selectFrom("signup_enrollment_authorizations")
        .selectAll()
        .where("token_digest", "=", input.enrollmentTokenDigest)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .where("expires_at", ">", input.now)
        .forUpdate()
        .executeTakeFirst();

      if (!authorization) {
        throw new EnrollmentAuthorizationRequiredError();
      }

      const challenge = await trx
        .selectFrom("webauthn_challenges")
        .selectAll()
        .where("enrollment_authorization_id", "=", authorization.id)
        .where("challenge_digest", "=", input.challengeDigest)
        .where("purpose", "=", SIGNUP_PASSKEY_REGISTRATION_PURPOSE)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .where("expires_at", ">", input.now)
        .whereRef("attempt_count", "<", "max_attempts")
        .forUpdate()
        .executeTakeFirst();

      if (!challenge) {
        throw new PasskeyRegistrationStateConflictError();
      }

      const existingUser = await trx
        .selectFrom("users")
        .select("id")
        .where((eb) =>
          eb.or([
            eb("email", "=", input.user.email),
            eb("webauthn_user_handle", "=", input.user.webauthnUserHandle ?? ""),
          ]),
        )
        .executeTakeFirst();

      if (existingUser) {
        throw new PasskeyRegistrationStateConflictError();
      }

      const consumedChallenge = await trx
        .updateTable("webauthn_challenges")
        .set({ consumed_at: input.now })
        .where("id", "=", challenge.id)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .executeTakeFirst();

      if (Number(consumedChallenge.numUpdatedRows) !== 1) {
        throw new PasskeyRegistrationStateConflictError();
      }

      const consumedAuthorization = await trx
        .updateTable("signup_enrollment_authorizations")
        .set({ consumed_at: input.now })
        .where("id", "=", authorization.id)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .executeTakeFirst();

      if (Number(consumedAuthorization.numUpdatedRows) !== 1) {
        throw new PasskeyRegistrationStateConflictError();
      }

      const userRow = await trx
        .insertInto("users")
        .values({
          id: input.user.id,
          email: input.user.email,
          password_hash: null,
          email_verified_at: input.user.emailVerifiedAt,
          webauthn_user_handle: input.user.webauthnUserHandle,
          tier: input.user.tier.value,
          created_at: input.user.createdAt.toISOString(),
          updated_at: input.user.updatedAt.toISOString(),
        })
        .returningAll()
        .executeTakeFirst();

      if (!userRow) {
        throw new PasskeyRegistrationStateConflictError();
      }

      const passkeyId = randomUUID();
      await trx
        .insertInto("passkey_credentials")
        .values({
          id: passkeyId,
          user_id: input.user.id,
          credential_id: input.passkey.credentialId,
          public_key: Buffer.from(input.passkey.publicKey),
          algorithm: input.passkey.algorithm,
          transports: input.passkey.transports,
          signature_counter: BigInt(input.passkey.signatureCounter),
          aaguid: input.passkey.aaguid,
          backup_eligible: input.passkey.backupEligible,
          backup_state: input.passkey.backupState,
          created_at: input.now,
          last_used_at: null,
          revoked_at: null,
        })
        .execute();

      const familyId = randomUUID();
      await trx
        .insertInto("remembered_device_families")
        .values({
          id: familyId,
          user_id: input.user.id,
          created_at: input.now,
          last_used_at: input.now,
          inactivity_expires_at: input.familyInactivityExpiresAt,
          absolute_expires_at: input.familyAbsoluteExpiresAt,
          recent_passkey_authentication_at: input.now,
          recent_passkey_authentication_purpose: "signup",
          authentication_method: "passkey",
          current_refresh_generation: 0,
          revoked_at: null,
          revocation_reason: null,
        })
        .execute();

      const refreshGenerationId = randomUUID();
      await trx
        .insertInto("refresh_token_generations")
        .values({
          id: refreshGenerationId,
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

      const sessionId = randomUUID();
      await trx
        .insertInto("sessions")
        .values({
          id: sessionId,
          user_id: input.user.id,
          token_digest: input.accessTokenDigest,
          transport: authorization.session_transport,
          mobile_platform: authorization.mobile_platform,
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
          user_id: input.user.id,
          event_type: PASSKEY_ADDED_EVENT_TYPE,
          created_at: input.now,
        })
        .execute();

      return {
        user: User.reconstitute({
          id: userRow.id,
          email: userRow.email,
          passwordHash: userRow.password_hash,
          emailVerifiedAt: userRow.email_verified_at,
          webauthnUserHandle: userRow.webauthn_user_handle,
          tier: userRow.tier,
          createdAt: new Date(userRow.created_at),
          updatedAt: new Date(userRow.updated_at),
        }),
        accessToken,
        refreshToken,
        accessInactivityExpiresAt: input.accessInactivityExpiresAt,
        familyInactivityExpiresAt: input.familyInactivityExpiresAt,
        familyAbsoluteExpiresAt: input.familyAbsoluteExpiresAt,
      };
    });
  }
}
