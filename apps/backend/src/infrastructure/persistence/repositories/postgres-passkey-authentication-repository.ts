import { PasskeyAuthenticationRateLimitedError } from "@application/errors/passkey-authentication-errors.js";
import {
  PASSKEY_AUTHENTICATION_OPTIONS_RATE_LIMIT_SCOPE,
  PASSKEY_AUTHENTICATION_VERIFICATION_RATE_LIMIT_SCOPE,
  PASSKEY_LOGIN_PURPOSE,
  type ConsumePasskeyAuthenticationVerificationRateLimitInput,
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
