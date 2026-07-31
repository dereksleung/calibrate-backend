import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("signup_enrollment_authorizations")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("email", "varchar(320)", (col) => col.notNull())
    .addColumn("token_digest", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("session_transport", "varchar(16)", (col) => col.notNull())
    .addColumn("mobile_platform", "varchar(16)")
    .addColumn("webauthn_user_handle", "varchar(128)", (col) => col.unique())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("consumed_at", "timestamptz")
    .addColumn("invalidated_at", "timestamptz")
    .execute();

  await db.schema
    .createIndex("signup_enrollment_authorizations_active_binding_idx")
    .on("signup_enrollment_authorizations")
    .columns(["email", "session_transport", "mobile_platform", "created_at"])
    .execute();
  await db.schema
    .createIndex("signup_enrollment_authorizations_retention_idx")
    .on("signup_enrollment_authorizations")
    .columns(["expires_at", "consumed_at"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("signup_enrollment_authorizations").execute();
}
