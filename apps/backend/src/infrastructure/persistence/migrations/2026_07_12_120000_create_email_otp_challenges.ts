import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("email_otp_challenges")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("email", "varchar(320)", (col) => col.notNull())
    .addColumn("purpose", "varchar(32)", (col) => col.notNull())
    .addColumn("code_digest", "varchar(64)", (col) => col.notNull())
    .addColumn("hmac_format_version", "integer", (col) => col.notNull())
    .addColumn("hmac_key_version", "integer", (col) => col.notNull())
    .addColumn("attempt_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("max_attempts", "integer", (col) => col.notNull())
    .addColumn("session_transport", "varchar(16)", (col) => col.notNull())
    .addColumn("mobile_platform", "varchar(16)")
    .addColumn("requesting_ip_digest", "varchar(64)")
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("consumed_at", "timestamptz")
    .addColumn("invalidated_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint("email_otp_attempt_count_nonnegative", sql`attempt_count >= 0`)
    .addCheckConstraint("email_otp_max_attempts_positive", sql`max_attempts > 0`)
    .execute();

  await db.schema
    .createIndex("email_otp_challenges_email_created_at_idx")
    .on("email_otp_challenges")
    .columns(["email", "created_at"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("email_otp_challenges").execute();
}
