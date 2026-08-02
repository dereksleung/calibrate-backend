import {
  PasskeyAuthenticationRateLimitedError,
  PasskeyAuthenticationStateConflictError,
} from "@application/errors/passkey-authentication-errors.js";
import {
  PASSKEY_AUTHENTICATION_OPTIONS_RATE_LIMIT_SCOPE,
  PASSKEY_AUTHENTICATION_VERIFICATION_RATE_LIMIT_SCOPE,
  PASSKEY_LOGIN_PURPOSE,
  type ConsumePasskeyAuthenticationVerificationRateLimitInput,
  type ActivePasskeyAuthenticationCredential,
  type CompletePasskeyAuthenticationInput,
  type IPasskeyAuthenticationRepository,
  type PreparedPasskeyAuthentication,
  type PreparePasskeyAuthenticationInput,
} from "@application/ports/passkey-authentication-repository.js";
import { sql, type Transaction } from "kysely";
import { createHmac, randomUUID } from "node:crypto";

import type { DatabaseClient, DatabaseSchema } from "../database-client.js";

const CHALLENGE_LIFETIME_MILLISECONDS = 5 * 60_000;
const RATE_LIMIT_WINDOW_MILLISECONDS = 60 * 60_000;
const RATE_LIMIT_RETENTION_MILLISECONDS = 24 * 60 * 60_000;

export class PostgresPasskeyAuthenticationRepository implements IPasskeyAuthenticationRepository {
  constructor(
    private readonly config: { ipDigestKey: Buffer },
    private readonly databaseClient: DatabaseClient,
  ) {}

  async prepareAuthentication(
    input: PreparePasskeyAuthenticationInput,
  ): Promise<PreparedPasskeyAuthentication> {
    const challengeExpiresAt = new Date(input.now.getTime() + CHALLENGE_LIFETIME_MILLISECONDS);
    await this.removeExpiredRateLimitEvents(input.now);

    return this.databaseClient.transaction().execute(async (trx) => {
      await this.configureTransaction(trx);
      await this.consumeRateLimit(trx, {
        scope: PASSKEY_AUTHENTICATION_OPTIONS_RATE_LIMIT_SCOPE,
        requestingIp: input.requestingIp,
        now: input.now,
        maxRequestsPerIp: input.maxOptionsRequestsPerIp,
        globalHourlyLimit: input.globalHourlyLimit,
      });

      const challengeId = randomUUID();
      await trx
        .insertInto("webauthn_challenges")
        .values({
          id: challengeId,
          enrollment_authorization_id: null,
          purpose: PASSKEY_LOGIN_PURPOSE,
          challenge_digest: input.challengeDigest,
          attempt_count: 0,
          max_attempts: input.maxVerificationAttempts,
          created_at: input.now,
          expires_at: challengeExpiresAt,
          consumed_at: null,
          invalidated_at: null,
        })
        .execute();

      return { challengeId, rawChallenge: input.rawChallenge, challengeExpiresAt };
    });
  }

  async consumeVerificationRateLimit(
    input: ConsumePasskeyAuthenticationVerificationRateLimitInput,
  ): Promise<void> {
    await this.removeExpiredRateLimitEvents(input.now);

    await this.databaseClient.transaction().execute(async (trx) => {
      await this.configureTransaction(trx);
      await this.consumeRateLimit(trx, {
        scope: PASSKEY_AUTHENTICATION_VERIFICATION_RATE_LIMIT_SCOPE,
        requestingIp: input.requestingIp,
        now: input.now,
        maxRequestsPerIp: input.maxVerificationRequestsPerIp,
        globalHourlyLimit: input.globalHourlyLimit,
      });
    });
  }

  async findActiveCredential(input: {
    credentialId: string;
    challengeDigest: string;
    now: Date;
  }): Promise<ActivePasskeyAuthenticationCredential | null> {
    const row = await this.databaseClient
      .selectFrom("webauthn_challenges as challenge")
      .innerJoin("passkey_credentials as credential", (join) =>
        join.on("credential.credential_id", "=", sql.lit(input.credentialId)),
      )
      .innerJoin("users as user", "user.id", "credential.user_id")
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
      .where("challenge.challenge_digest", "=", input.challengeDigest)
      .where("challenge.purpose", "=", PASSKEY_LOGIN_PURPOSE)
      .where("challenge.consumed_at", "is", null)
      .where("challenge.invalidated_at", "is", null)
      .where("challenge.expires_at", ">", input.now)
      .whereRef("challenge.attempt_count", "<", "challenge.max_attempts")
      .where("credential.revoked_at", "is", null)
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
      .where("purpose", "=", PASSKEY_LOGIN_PURPOSE)
      .where("consumed_at", "is", null)
      .where("invalidated_at", "is", null)
      .where("expires_at", ">", input.now)
      .whereRef("attempt_count", "<", "max_attempts")
      .execute();
  }

  async completeAuthentication(input: CompletePasskeyAuthenticationInput): Promise<{ userId: string }> {
    return this.databaseClient.transaction().execute(async (trx) => {
      await this.configureTransaction(trx);
      const credential = await trx
        .selectFrom("passkey_credentials as credential")
        .innerJoin("users as user", "user.id", "credential.user_id")
        .select(["credential.id", "credential.user_id"])
        .where("credential.credential_id", "=", input.credentialId)
        .where("credential.revoked_at", "is", null)
        .forUpdate()
        .executeTakeFirst();
      const challenge = await trx
        .selectFrom("webauthn_challenges")
        .select("id")
        .where("challenge_digest", "=", input.challengeDigest)
        .where("purpose", "=", PASSKEY_LOGIN_PURPOSE)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .where("expires_at", ">", input.now)
        .whereRef("attempt_count", "<", "max_attempts")
        .forUpdate()
        .executeTakeFirst();
      if (!credential || !challenge) throw new PasskeyAuthenticationStateConflictError();
      const consumed = await trx.updateTable("webauthn_challenges").set({ consumed_at: input.now }).where("id", "=", challenge.id).where("consumed_at", "is", null).executeTakeFirst();
      if (Number(consumed.numUpdatedRows) !== 1) throw new PasskeyAuthenticationStateConflictError();
      await trx.updateTable("passkey_credentials").set({ signature_counter: BigInt(input.newCounter), backup_state: input.backupState, last_used_at: input.now }).where("id", "=", credential.id).execute();
      const familyId = randomUUID();
      await trx.insertInto("remembered_device_families").values({ id: familyId, user_id: credential.user_id, created_at: input.now, last_used_at: input.now, inactivity_expires_at: input.familyInactivityExpiresAt, absolute_expires_at: input.familyAbsoluteExpiresAt, recent_passkey_authentication_at: input.now, recent_passkey_authentication_purpose: "login", authentication_method: "passkey", current_refresh_generation: 0, revoked_at: null, revocation_reason: null }).execute();
      await trx.insertInto("refresh_token_generations").values({ id: randomUUID(), family_id: familyId, generation: 0, token_digest: input.refreshTokenDigest, parent_generation_id: null, replacement_generation_id: null, created_at: input.now, expires_at: input.familyAbsoluteExpiresAt, consumed_at: null, revoked_at: null }).execute();
      await trx.insertInto("sessions").values({ id: randomUUID(), user_id: credential.user_id, token_digest: input.accessTokenDigest, transport: "cookie", mobile_platform: null, remembered_device_family_id: familyId, replaced_by_session_id: null, created_at: input.now, last_seen_at: input.now, inactivity_expires_at: input.accessInactivityExpiresAt, absolute_expires_at: input.accessAbsoluteExpiresAt, revoked_at: null, renewed_at: null }).execute();
      await trx.insertInto("security_events").values({ id: randomUUID(), user_id: credential.user_id, event_type: "family-created", created_at: input.now }).execute();
      if (input.counterAnomaly) {
        await trx
          .insertInto("security_events")
          .values({
            id: randomUUID(),
            user_id: credential.user_id,
            event_type: "passkey-counter-anomaly",
            created_at: input.now,
          })
          .execute();
      }
      return { userId: credential.user_id };
    });
  }

  private async configureTransaction(trx: Transaction<DatabaseSchema>): Promise<void> {
    await sql`set local lock_timeout = '2s'`.execute(trx);
    await sql`set local statement_timeout = '5s'`.execute(trx);
  }

  private async consumeRateLimit(
    trx: Transaction<DatabaseSchema>,
    input: {
      scope: string;
      requestingIp: string;
      now: Date;
      maxRequestsPerIp: number;
      globalHourlyLimit: number;
    },
  ): Promise<void> {
    const requestingIpDigest = this.digestIp(input.requestingIp);
    const windowStart = new Date(input.now.getTime() - RATE_LIMIT_WINDOW_MILLISECONDS);
    await sql`select pg_advisory_xact_lock(hashtext(${input.scope}))`.execute(trx);

    const [ipEvents, globalEvents] = await Promise.all([
      trx
        .selectFrom("passkey_authentication_rate_limit_events")
        .select("created_at")
        .where("scope", "=", input.scope)
        .where("requesting_ip_digest", "=", requestingIpDigest)
        .where("created_at", ">", windowStart)
        .orderBy("created_at", "asc")
        .execute(),
      trx
        .selectFrom("passkey_authentication_rate_limit_events")
        .select("created_at")
        .where("scope", "=", input.scope)
        .where("created_at", ">", windowStart)
        .orderBy("created_at", "asc")
        .execute(),
    ]);
    const limitingEvent =
      ipEvents.length >= input.maxRequestsPerIp
        ? ipEvents[0]
        : globalEvents.length >= input.globalHourlyLimit
          ? globalEvents[0]
          : undefined;
    if (limitingEvent) {
      throw new PasskeyAuthenticationRateLimitedError(
        Math.max(
          1,
          Math.ceil(
            (limitingEvent.created_at.getTime() + RATE_LIMIT_WINDOW_MILLISECONDS - input.now.getTime()) /
              1000,
          ),
        ),
      );
    }

    await trx
      .insertInto("passkey_authentication_rate_limit_events")
      .values({
        id: randomUUID(),
        scope: input.scope,
        requesting_ip_digest: requestingIpDigest,
        created_at: input.now,
      })
      .execute();
  }

  private async removeExpiredRateLimitEvents(now: Date): Promise<void> {
    await this.databaseClient
      .deleteFrom("passkey_authentication_rate_limit_events")
      .where("created_at", "<", new Date(now.getTime() - RATE_LIMIT_RETENTION_MILLISECONDS))
      .execute();
  }

  private digestIp(ip: string): string {
    return createHmac("sha256", this.config.ipDigestKey).update(ip).digest("base64url");
  }
}
