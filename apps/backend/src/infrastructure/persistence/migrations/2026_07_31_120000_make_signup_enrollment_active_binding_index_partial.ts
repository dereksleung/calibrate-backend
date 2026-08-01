import { Kysely, sql } from "kysely";

const INDEX_NAME = "signup_enrollment_authorizations_active_binding_idx";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex(INDEX_NAME).execute();

  await db.schema
    .createIndex(INDEX_NAME)
    .on("signup_enrollment_authorizations")
    .columns(["email", "session_transport", "mobile_platform"])
    .where(sql.ref("consumed_at"), "is", null)
    .where(sql.ref("invalidated_at"), "is", null)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex(INDEX_NAME).execute();

  await db.schema
    .createIndex(INDEX_NAME)
    .on("signup_enrollment_authorizations")
    .columns(["email", "session_transport", "mobile_platform", "created_at"])
    .execute();
}
