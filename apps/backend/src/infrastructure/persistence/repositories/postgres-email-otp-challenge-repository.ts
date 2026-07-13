import type { Kysely } from "kysely";

import { IEmailOtpChallengeRepository, NewEmailOtpChallenge, RateLimitError } from "@application";
import { sql } from "kysely";
import { createHmac } from "node:crypto";

import { db, type Database } from "../database.js";

const RESEND_COOLDOWN_MILLISECONDS = 60_000;

export class PostgresEmailOtpChallengeRepository implements IEmailOtpChallengeRepository {
  constructor(
    private readonly database: Kysely<Database> = db,
    private readonly ipDigestKey?: Buffer,
  ) {}

  async create(challenge: NewEmailOtpChallenge): Promise<void> {
    await this.database.transaction().execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${challenge.email}, 0))`.execute(trx);

      const latest = await trx
        .selectFrom("email_otp_challenges")
        .select("created_at")
        .where("email", "=", challenge.email)
        .where("invalidated_at", "is", null)
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirst();

      if (
        latest &&
        challenge.createdAt.getTime() - latest.created_at.getTime() < RESEND_COOLDOWN_MILLISECONDS
      ) {
        throw new RateLimitError("Please wait before requesting another code");
      }

      await trx
        .updateTable("email_otp_challenges")
        .set({ invalidated_at: challenge.createdAt })
        .where("email", "=", challenge.email)
        .where("purpose", "=", challenge.purpose)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .execute();

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
          requesting_ip_digest: this.digestIp(challenge.requestingIp),
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

  private digestIp(ip: string | null): string | null {
    if (!ip || !this.ipDigestKey) return null;
    return createHmac("sha256", this.ipDigestKey).update(ip).digest("base64url");
  }
}
