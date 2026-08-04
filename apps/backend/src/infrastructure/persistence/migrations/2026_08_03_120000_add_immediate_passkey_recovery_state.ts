import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("account_access_authorizations")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("user_id", "uuid", (column) => column.references("users.id").notNull().onDelete("cascade"))
    .addColumn("source_otp_challenge_id", "uuid", (column) =>
      column.references("email_otp_challenges.id").notNull().onDelete("cascade"),
    )
    .addColumn("token_digest", "varchar(64)", (column) => column.notNull().unique())
    .addColumn("client_binding", "varchar(128)", (column) => column.notNull())
    .addColumn("created_at", "timestamptz", (column) => column.notNull())
    .addColumn("expires_at", "timestamptz", (column) => column.notNull())
    .addColumn("consumed_at", "timestamptz")
    .addColumn("invalidated_at", "timestamptz")
    .addUniqueConstraint("account_access_authorizations_source_otp_challenge_key", ["source_otp_challenge_id"])
    .execute();

  await db.schema
    .createIndex("account_access_authorizations_active_binding_idx")
    .on("account_access_authorizations")
    .columns(["user_id", "client_binding", "created_at"])
    .execute();

  await db.schema
    .createTable("account_recoveries")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("user_id", "uuid", (column) => column.references("users.id").notNull().onDelete("cascade"))
    .addColumn("provisional_passkey_id", "uuid")
    .addColumn("registered_at", "timestamptz", (column) => column.notNull())
    .addColumn("restriction_ends_at", "timestamptz", (column) => column.notNull())
    .addColumn("promoted_at", "timestamptz")
    .addColumn("cancelled_at", "timestamptz")
    .addColumn("replaced_at", "timestamptz")
    .addColumn("terminal_reason", "varchar(64)")
    .execute();

  await sql`
    alter table "account_recoveries"
    add constraint "account_recoveries_restriction_after_registration"
    check ("restriction_ends_at" > "registered_at")
  `.execute(db);
  await sql`
    create unique index "account_recoveries_one_active_per_user_idx"
    on "account_recoveries" ("user_id")
    where "promoted_at" is null and "cancelled_at" is null and "replaced_at" is null
  `.execute(db);

  await db.schema
    .createTable("recovery_registration_authorizations")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("user_id", "uuid", (column) => column.references("users.id").notNull().onDelete("cascade"))
    .addColumn("account_access_authorization_id", "uuid", (column) =>
      column.references("account_access_authorizations.id").notNull().onDelete("cascade"),
    )
    .addColumn("replaces_recovery_id", "uuid", (column) => column.references("account_recoveries.id").onDelete("restrict"))
    .addColumn("token_digest", "varchar(64)", (column) => column.notNull().unique())
    .addColumn("client_binding", "varchar(128)", (column) => column.notNull())
    .addColumn("created_at", "timestamptz", (column) => column.notNull())
    .addColumn("expires_at", "timestamptz", (column) => column.notNull())
    .addColumn("consumed_at", "timestamptz")
    .addColumn("invalidated_at", "timestamptz")
    .addUniqueConstraint("recovery_registration_authorizations_account_access_key", ["account_access_authorization_id"])
    .execute();

  await db.schema
    .alterTable("passkey_credentials")
    .addColumn("recovery_id", "uuid", (column) => column.references("account_recoveries.id").onDelete("restrict"))
    .addColumn("trust_state", "varchar(16)", (column) => column.notNull().defaultTo("trusted"))
    .execute();
  await sql`
    alter table "passkey_credentials"
    add constraint "passkey_credentials_recovery_trust_state"
    check (("trust_state" = 'trusted' and "recovery_id" is null) or ("trust_state" = 'provisional' and "recovery_id" is not null))
  `.execute(db);
  await db.schema
    .alterTable("account_recoveries")
    .addForeignKeyConstraint(
      "account_recoveries_provisional_passkey_id_fkey",
      ["provisional_passkey_id"],
      "passkey_credentials",
      ["id"],
      (constraint) => constraint.onDelete("restrict"),
    )
    .execute();

  await db.schema
    .alterTable("remembered_device_families")
    .addColumn("recovery_id", "uuid", (column) => column.references("account_recoveries.id").onDelete("restrict"))
    .addColumn("recovery_restriction_ends_at", "timestamptz")
    .addColumn("recent_passkey_authentication_credential_id", "uuid", (column) =>
      column.references("passkey_credentials.id").onDelete("set null"),
    )
    .execute();
  await sql`
    alter table "remembered_device_families"
    add constraint "remembered_device_families_recovery_provenance_complete"
    check (("recovery_id" is null) = ("recovery_restriction_ends_at" is null))
  `.execute(db);

  await db.schema
    .alterTable("webauthn_challenges")
    .addColumn("account_access_authorization_id", "uuid", (column) =>
      column.references("account_access_authorizations.id").onDelete("cascade"),
    )
    .addColumn("recovery_registration_authorization_id", "uuid", (column) =>
      column.references("recovery_registration_authorizations.id").onDelete("cascade"),
    )
    .addColumn("recovery_id", "uuid", (column) => column.references("account_recoveries.id").onDelete("cascade"))
    .execute();
  await sql`
    alter table "webauthn_challenges"
    add constraint "webauthn_challenges_recovery_purpose_binding"
    check (
      ("purpose" = 'identified-passkey-login' and "account_access_authorization_id" is not null)
      or ("purpose" = 'account-recovery-passkey-registration' and "recovery_registration_authorization_id" is not null)
      or ("purpose" = 'account-recovery-promotion' and "recovery_id" is not null)
      or "purpose" not in ('identified-passkey-login', 'account-recovery-passkey-registration', 'account-recovery-promotion')
    )
  `.execute(db);

  await db.schema
    .createTable("security_notification_outbox")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("security_event_id", "uuid", (column) => column.references("security_events.id").notNull().onDelete("cascade").unique())
    .addColumn("user_id", "uuid", (column) => column.references("users.id").notNull().onDelete("cascade"))
    .addColumn("event_type", "varchar(64)", (column) => column.notNull())
    .addColumn("payload", "jsonb", (column) => column.notNull())
    .addColumn("attempt_count", "integer", (column) => column.notNull().defaultTo(0))
    .addColumn("next_attempt_at", "timestamptz", (column) => column.notNull())
    .addColumn("delivered_at", "timestamptz")
    .addColumn("failed_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) => column.notNull())
    .execute();
  await db.schema
    .createIndex("security_notification_outbox_pending_idx")
    .on("security_notification_outbox")
    .columns(["next_attempt_at", "created_at"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("security_notification_outbox").execute();
  await sql`alter table "webauthn_challenges" drop constraint "webauthn_challenges_recovery_purpose_binding"`.execute(db);
  await db.schema.alterTable("webauthn_challenges").dropColumn("recovery_id").dropColumn("recovery_registration_authorization_id").dropColumn("account_access_authorization_id").execute();
  await sql`alter table "remembered_device_families" drop constraint "remembered_device_families_recovery_provenance_complete"`.execute(db);
  await db.schema.alterTable("remembered_device_families").dropColumn("recent_passkey_authentication_credential_id").dropColumn("recovery_restriction_ends_at").dropColumn("recovery_id").execute();
  await db.schema.alterTable("account_recoveries").dropConstraint("account_recoveries_provisional_passkey_id_fkey").execute();
  await sql`alter table "passkey_credentials" drop constraint "passkey_credentials_recovery_trust_state"`.execute(db);
  await db.schema.alterTable("passkey_credentials").dropColumn("trust_state").dropColumn("recovery_id").execute();
  await db.schema.dropTable("recovery_registration_authorizations").execute();
  await db.schema.dropTable("account_recoveries").execute();
  await db.schema.dropTable("account_access_authorizations").execute();
}
