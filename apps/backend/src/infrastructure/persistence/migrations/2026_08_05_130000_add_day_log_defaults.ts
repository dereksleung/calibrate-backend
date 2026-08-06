import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);

  await db.schema
    .alterTable("day_logs")
    .alterColumn("id", (column) => column.setDefault(sql`gen_random_uuid()`))
    .alterColumn("created_at", (column) => column.setDefault(sql`now()`))
    .alterColumn("updated_at", (column) => column.setDefault(sql`now()`))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("day_logs")
    .alterColumn("id", (column) => column.dropDefault())
    .alterColumn("created_at", (column) => column.dropDefault())
    .alterColumn("updated_at", (column) => column.dropDefault())
    .execute();
}
