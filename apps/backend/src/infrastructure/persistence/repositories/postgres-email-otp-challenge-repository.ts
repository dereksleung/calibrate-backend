import type { Kysely } from "kysely";

import {
  EmailOtpChallenge,
  IEmailOtpChallengeRepository,
  NewEmailOtpChallenge,
  RateLimitError,
} from "@application";
import { sql } from "kysely";
import { createHmac } from "node:crypto";

import { db, type Database } from "../database.js";

const RESEND_COOLDOWN_MILLISECONDS = 60_000;
const RATE_LIMIT_WINDOW_MILLISECONDS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_EMAIL_PER_HOUR = 5;
const MAX_REQUESTS_PER_IP_PER_HOUR = 20;
const DELIVERY_RATE_LIMIT_LOCK_ID = 1_426_374_925;
const RATE_LIMIT_MESSAGE = "Too many verification-code requests";

export class PostgresEmailOtpChallengeRepository implements IEmailOtpChallengeRepository {
  constructor(
    private readonly config: {
      ipDigestKey: Buffer;
      globalHourlyLimit: number;
    },
    private readonly database: Kysely<Database> = db,
  ) {}

  async create(challenge: NewEmailOtpChallenge): Promise<void> {
    const requestingIpDigest = this.digestIp(challenge.requestingIp);
    const rateLimitWindowStart = new Date(challenge.createdAt.getTime() - RATE_LIMIT_WINDOW_MILLISECONDS);

    await this.database.transaction().execute(async (trx) => {
      // Prevent lock acquisition or rate-limit queries from waiting indefinitely.
      await sql`set local lock_timeout = '2s'`.execute(trx);
      await sql`set local statement_timeout = '5s'`.execute(trx);
      await sql`select pg_advisory_xact_lock(${DELIVERY_RATE_LIMIT_LOCK_ID})`.execute(trx);

      const latest = await trx
        .selectFrom("email_otp_challenges")
        .select("created_at")
        .where("email", "=", challenge.email)
        .where("purpose", "=", challenge.purpose)
        .where("session_transport", "=", challenge.sessionTransport)
        .$if(challenge.mobilePlatform === null, (query) => query.where("mobile_platform", "is", null))
        .$if(challenge.mobilePlatform !== null, (query) =>
          query.where("mobile_platform", "=", challenge.mobilePlatform),
        )
        .where("invalidated_at", "is", null)
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirst();

      if (
        latest &&
        challenge.createdAt.getTime() - latest.created_at.getTime() < RESEND_COOLDOWN_MILLISECONDS
      ) {
        throw new RateLimitError(RATE_LIMIT_MESSAGE);
      }

      const emailRequestCount = await trx
        .selectFrom("email_otp_challenges")
        .select(({ fn }) => fn.countAll<number>().as("count"))
        .where("email", "=", challenge.email)
        .where("purpose", "=", challenge.purpose)
        .where("created_at", ">=", rateLimitWindowStart)
        .executeTakeFirstOrThrow();

      const ipRequestCount = await trx
        .selectFrom("email_otp_challenges")
        .select(({ fn }) => fn.countAll<number>().as("count"))
        .where("requesting_ip_digest", "=", requestingIpDigest)
        .where("created_at", ">=", rateLimitWindowStart)
        .executeTakeFirstOrThrow();

      const globalRequestCount = await trx
        .selectFrom("email_otp_challenges")
        .select(({ fn }) => fn.countAll<number>().as("count"))
        .where("created_at", ">=", rateLimitWindowStart)
        .executeTakeFirstOrThrow();

      if (
        Number(emailRequestCount.count) >= MAX_REQUESTS_PER_EMAIL_PER_HOUR ||
        Number(ipRequestCount.count) >= MAX_REQUESTS_PER_IP_PER_HOUR ||
        Number(globalRequestCount.count) >= this.config.globalHourlyLimit
      ) {
        throw new RateLimitError(RATE_LIMIT_MESSAGE);
      }

      let invalidationQuery = trx
        .updateTable("email_otp_challenges")
        .set({ invalidated_at: challenge.createdAt })
        .where("email", "=", challenge.email)
        .where("purpose", "=", challenge.purpose)
        .where("session_transport", "=", challenge.sessionTransport)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null);

      invalidationQuery =
        challenge.mobilePlatform === null
          ? invalidationQuery.where("mobile_platform", "is", null)
          : invalidationQuery.where("mobile_platform", "=", challenge.mobilePlatform);

      await invalidationQuery.execute();

      await trx
        .insertInto("email_otp_challenges")
        .values({
          id: challenge.id,
          email: challenge.email,
          purpose: challenge.purpose,
          code_digest: challenge.codeDigest,
          hmac_format_version: challenge.hmacFormatVersion,
          hmac_key_version: challenge.hmacKeyVersion,
          attempt_count: challenge.attemptCount,
          max_attempts: challenge.maxAttempts,
          session_transport: challenge.sessionTransport,
          mobile_platform: challenge.mobilePlatform,
          requesting_ip_digest: requestingIpDigest,
          expires_at: challenge.expiresAt,
          consumed_at: null,
          invalidated_at: null,
          created_at: challenge.createdAt,
        })
        .execute();
    });
  }

  async invalidate(challengeId: string, invalidatedAt: Date): Promise<void> {
    await this.database
      .updateTable("email_otp_challenges")
      .set({ invalidated_at: invalidatedAt })
      .where("id", "=", challengeId)
      .where("consumed_at", "is", null)
      .where("invalidated_at", "is", null)
      .execute();
  }

  async findById(challengeId: string): Promise<EmailOtpChallenge | null> {
    const row = await this.database
      .selectFrom("email_otp_challenges")
      .selectAll()
      .where("id", "=", challengeId)
      .executeTakeFirst();

    return row ? this.mapChallenge(row) : null;
  }

  async recordFailedAttempt(challengeId: string, attemptedAt: Date): Promise<void> {
    await this.database
      .updateTable("email_otp_challenges")
      .set({ attempt_count: sql<number>`attempt_count + 1` })
      .where("id", "=", challengeId)
      .where("consumed_at", "is", null)
      .where("invalidated_at", "is", null)
      .where("expires_at", ">", attemptedAt)
      .whereRef("attempt_count", "<", "max_attempts")
      .execute();
  }

  private digestIp(ip: string): string {
    return createHmac("sha256", this.config.ipDigestKey).update(ip).digest("base64url");
  }

  private mapChallenge(row: {
    id: string;
    email: string;
    purpose: EmailOtpChallenge["purpose"];
    code_digest: string;
    hmac_format_version: number;
    hmac_key_version: number;
    attempt_count: number;
    max_attempts: number;
    session_transport: EmailOtpChallenge["sessionTransport"];
    mobile_platform: EmailOtpChallenge["mobilePlatform"];
    requesting_ip_digest: string | null;
    expires_at: Date;
    consumed_at: Date | null;
    invalidated_at: Date | null;
    created_at: Date;
  }): EmailOtpChallenge {
    return {
      id: row.id,
      email: row.email,
      purpose: row.purpose,
      codeDigest: row.code_digest,
      hmacFormatVersion: row.hmac_format_version,
      hmacKeyVersion: row.hmac_key_version,
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
      sessionTransport: row.session_transport,
      mobilePlatform: row.mobile_platform,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at,
      invalidatedAt: row.invalidated_at,
    };
  }
}
