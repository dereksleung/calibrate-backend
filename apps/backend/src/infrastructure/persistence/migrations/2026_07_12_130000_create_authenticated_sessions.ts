import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("users")
    .alterColumn("password_hash", (col) => col.dropNotNull())
    .execute();
  await db.schema.alterTable("users").addColumn("email_verified_at", "timestamptz").execute();

  await db.schema
    .createTable("sessions")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) => col.references("users.id").notNull().onDelete("cascade"))
    .addColumn("token_digest", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("transport", "varchar(10)", (col) => col.notNull())
    .addColumn("mobile_platform", "varchar(10)")
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addColumn("last_seen_at", "timestamptz", (col) => col.notNull())
    .addColumn("inactivity_expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("absolute_expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("revoked_at", "timestamptz")
    .addColumn("renewed_at", "timestamptz")
    .execute();

  await db.schema.createIndex("idx_sessions_user_id").on("sessions").column("user_id").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("sessions").execute();
  await db.schema.alterTable("users").dropColumn("email_verified_at").execute();
  await db.schema
    .alterTable("users")
    .alterColumn("password_hash", (col) => col.setNotNull())
    .execute();
}
