import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("users")
    .addColumn("webauthn_user_handle", "varchar(128)", (col) => col.unique())
    .execute();

  await db.schema
    .createTable("webauthn_challenges")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("enrollment_authorization_id", "uuid", (col) =>
      col.references("signup_enrollment_authorizations.id").notNull().onDelete("cascade"),
    )
    .addColumn("purpose", "varchar(64)", (col) => col.notNull())
    .addColumn("challenge_digest", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("attempt_count", "integer", (col) => col.notNull())
    .addColumn("max_attempts", "integer", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("consumed_at", "timestamptz")
    .addColumn("invalidated_at", "timestamptz")
    .execute();

  await db.schema
    .createIndex("webauthn_challenges_enrollment_purpose_idx")
    .on("webauthn_challenges")
    .columns(["enrollment_authorization_id", "purpose", "created_at"])
    .execute();

  await db.schema
    .createTable("passkey_credentials")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) => col.references("users.id").notNull().onDelete("cascade"))
    .addColumn("credential_id", "text", (col) => col.notNull().unique())
    .addColumn("public_key", "bytea", (col) => col.notNull())
    .addColumn("algorithm", "integer", (col) => col.notNull())
    .addColumn("transports", sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'`))
    .addColumn("signature_counter", "bigint", (col) => col.notNull())
    .addColumn("aaguid", "uuid", (col) => col.notNull())
    .addColumn("backup_eligible", "boolean", (col) => col.notNull())
    .addColumn("backup_state", "boolean", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addColumn("last_used_at", "timestamptz")
    .addColumn("revoked_at", "timestamptz")
    .execute();

  await db.schema
    .createTable("remembered_device_families")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) => col.references("users.id").notNull().onDelete("cascade"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addColumn("last_used_at", "timestamptz", (col) => col.notNull())
    .addColumn("inactivity_expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("absolute_expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("recent_passkey_authentication_at", "timestamptz")
    .addColumn("recent_passkey_authentication_purpose", "varchar(64)")
    .addColumn("authentication_method", "varchar(32)", (col) => col.notNull())
    .addColumn("current_refresh_generation", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("revoked_at", "timestamptz")
    .addColumn("revocation_reason", "varchar(64)")
    .execute();

  await db.schema
    .createTable("refresh_token_generations")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("family_id", "uuid", (col) =>
      col.references("remembered_device_families.id").notNull().onDelete("cascade"),
    )
    .addColumn("generation", "integer", (col) => col.notNull())
    .addColumn("token_digest", "varchar(64)", (col) => col.notNull().unique())
    .addColumn("parent_generation_id", "uuid")
    .addColumn("replacement_generation_id", "uuid")
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("consumed_at", "timestamptz")
    .addColumn("revoked_at", "timestamptz")
    .execute();

  await db.schema
    .createIndex("refresh_token_generations_family_generation_idx")
    .on("refresh_token_generations")
    .columns(["family_id", "generation"])
    .unique()
    .execute();

  await db.schema
    .alterTable("sessions")
    .addColumn("remembered_device_family_id", "uuid", (col) =>
      col.references("remembered_device_families.id").onDelete("set null"),
    )
    .addColumn("replaced_by_session_id", "uuid")
    .execute();

  await db.schema
    .createTable("security_events")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) => col.references("users.id").notNull().onDelete("cascade"))
    .addColumn("event_type", "varchar(64)", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("security_events").execute();
  await db.schema.alterTable("sessions").dropColumn("replaced_by_session_id").execute();
  await db.schema.alterTable("sessions").dropColumn("remembered_device_family_id").execute();
  await db.schema.dropTable("refresh_token_generations").execute();
  await db.schema.dropTable("remembered_device_families").execute();
  await db.schema.dropTable("passkey_credentials").execute();
  await db.schema.dropTable("webauthn_challenges").execute();
  await db.schema.alterTable("users").dropColumn("webauthn_user_handle").execute();
}
