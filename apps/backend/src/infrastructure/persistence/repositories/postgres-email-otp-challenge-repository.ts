import type { Kysely } from "kysely";

import {
  ConsumeEmailOtpChallengeProps,
  EmailOtpChallenge,
  IEmailOtpChallengeRepository,
  NewEmailOtpChallenge,
  RateLimitError,
} from "@application";
import { User } from "@domain";
import { sql } from "kysely";
import { createHmac, randomUUID } from "node:crypto";

import { db, type Database } from "../database.js";

const RESEND_COOLDOWN_MILLISECONDS = 60_000;

export class PostgresEmailOtpChallengeRepository implements IEmailOtpChallengeRepository {
  constructor(
    private readonly database: Kysely<Database> = db,
    private readonly ipDigestKey?: Buffer,
  ) {}

  async create(challenge: NewEmailOtpChallenge): Promise<void> {
    await this.database.transaction().execute(async (trx) => {
      // Prevents lock aquisition waiting indefinitely
      await sql`set local lock_timeout = '2s'`.execute(trx);
      await sql`set local statement_timeout = '5s'`.execute(trx);
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

  async consumeAndCreateSession(props: ConsumeEmailOtpChallengeProps): Promise<User | null> {
    return this.database.transaction().execute(async (trx) => {
      await sql`set local lock_timeout = '2s'`.execute(trx);
      await sql`set local statement_timeout = '5s'`.execute(trx);

      const challenge = await trx
        .selectFrom("email_otp_challenges")
        .selectAll()
        .where("id", "=", props.challengeId)
        .forUpdate()
        .executeTakeFirst();

      if (
        !challenge ||
        challenge.consumed_at ||
        challenge.invalidated_at ||
        challenge.expires_at.getTime() <= props.verifiedAt.getTime() ||
        challenge.attempt_count >= challenge.max_attempts ||
        challenge.session_transport !== props.session.transport ||
        challenge.mobile_platform !== props.session.mobilePlatform
      ) {
        return null;
      }

      await trx
        .updateTable("email_otp_challenges")
        .set({ consumed_at: props.verifiedAt })
        .where("id", "=", challenge.id)
        .execute();

      const userRow = await trx
        .insertInto("users")
        .values({
          id: randomUUID(),
          email: challenge.email,
          password_hash: null,
          email_verified_at: props.verifiedAt,
          tier: "FREE",
          created_at: props.verifiedAt.toISOString(),
          updated_at: props.verifiedAt.toISOString(),
        })
        .onConflict((conflict) =>
          conflict.column("email").doUpdateSet({
            email_verified_at: props.verifiedAt,
            updated_at: props.verifiedAt,
          }),
        )
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("sessions")
        .values({
          id: randomUUID(),
          user_id: userRow.id,
          token_digest: props.session.tokenDigest,
          transport: props.session.transport,
          mobile_platform: props.session.mobilePlatform,
          created_at: props.session.createdAt,
          last_seen_at: props.session.lastSeenAt,
          inactivity_expires_at: props.session.inactivityExpiresAt,
          absolute_expires_at: props.session.absoluteExpiresAt,
          revoked_at: null,
          renewed_at: null,
        })
        .execute();

      return User.reconstitute({
        id: userRow.id,
        email: userRow.email,
        passwordHash: userRow.password_hash,
        emailVerifiedAt: userRow.email_verified_at,
        tier: userRow.tier,
        createdAt: new Date(userRow.created_at),
        updatedAt: new Date(userRow.updated_at),
      });
    });
  }

  private digestIp(ip: string | null): string | null {
    if (!ip || !this.ipDigestKey) return null;
    return createHmac("sha256", this.ipDigestKey).update(ip).digest("base64url");
  }

  private mapChallenge(row: {
    id: string;
    email: string;
    purpose: "authentication";
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
