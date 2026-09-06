import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("day_logs")
    .addColumn("version_number", "integer", (col) => col.notNull().defaultTo(1))
    .execute();

  await sql`
    update day_logs
    set version_number = 1
    where version_number is distinct from 1
  `.execute(db);

  await db.schema
    .alterTable("day_logs")
    .addCheckConstraint(
      "day_logs_version_number_positive_int32",
      sql`version_number >= 1 AND version_number <= 2147483647`,
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("day_logs").dropConstraint("day_logs_version_number_positive_int32").execute();
  await db.schema.alterTable("day_logs").dropColumn("version_number").execute();
}
