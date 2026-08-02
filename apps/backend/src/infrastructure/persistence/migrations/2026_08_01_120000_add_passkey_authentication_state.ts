import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("webauthn_challenges")
    .alterColumn("enrollment_authorization_id", (column) => column.dropNotNull())
    .execute();

  await sql`
    alter table "webauthn_challenges"
    add constraint "webauthn_challenges_signup_enrollment_required"
    check (
      "purpose" <> 'signup-passkey-registration'
      or "enrollment_authorization_id" is not null
    )
  `.execute(db);

  await db.schema
    .createTable("passkey_authentication_rate_limit_events")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("scope", "varchar(64)", (column) => column.notNull())
    .addColumn("requesting_ip_digest", "varchar(64)", (column) => column.notNull())
    .addColumn("created_at", "timestamptz", (column) => column.notNull())
    .execute();

  await db.schema
    .createIndex("passkey_authentication_rate_limit_events_scope_ip_created_idx")
    .on("passkey_authentication_rate_limit_events")
    .columns(["scope", "requesting_ip_digest", "created_at"])
    .execute();

  await db.schema
    .createIndex("passkey_authentication_rate_limit_events_scope_created_idx")
    .on("passkey_authentication_rate_limit_events")
    .columns(["scope", "created_at"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("passkey_authentication_rate_limit_events").execute();
  await sql`
    alter table "webauthn_challenges"
    drop constraint "webauthn_challenges_signup_enrollment_required"
  `.execute(db);
  await db.schema
    .alterTable("webauthn_challenges")
    .alterColumn("enrollment_authorization_id", (column) => column.setNotNull())
    .execute();
}
