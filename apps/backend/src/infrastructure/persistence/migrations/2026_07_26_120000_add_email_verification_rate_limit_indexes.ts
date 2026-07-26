import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex("email_otp_challenges_email_purpose_created_at_idx")
    .on("email_otp_challenges")
    .columns(["email", "purpose", "created_at"])
    .execute();

  await db.schema
    .createIndex("email_otp_challenges_ip_created_at_idx")
    .on("email_otp_challenges")
    .columns(["requesting_ip_digest", "created_at"])
    .execute();

  await db.schema
    .createIndex("email_otp_challenges_created_at_idx")
    .on("email_otp_challenges")
    .column("created_at")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("email_otp_challenges_created_at_idx").execute();
  await db.schema.dropIndex("email_otp_challenges_ip_created_at_idx").execute();
  await db.schema.dropIndex("email_otp_challenges_email_purpose_created_at_idx").execute();
}
