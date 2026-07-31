import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("food_entries")
    .addColumn("chosen_quantity", "numeric(5, 2)")
    .addColumn("chosen_unit", "varchar(20)")
    .addColumn("quantity_serving", "numeric(5, 2)")
    .addColumn("serving_label", "varchar(20)")
    .addColumn("quantity_mass", "numeric(5, 2)")
    .addColumn("mass_unit", "varchar(20)")
    .addColumn("quantity_volume", "numeric(5, 2)")
    .addColumn("volume_unit", "varchar(20)")
    .execute();

  await db
    .updateTable("food_entries")
    .set({
      chosen_quantity: sql`quantity`,
      chosen_unit: sql`quantity_unit`,
      quantity_serving: sql`quantity`,
      serving_label: sql`quantity_unit`,
    })
    .execute();

  await db.schema
    .alterTable("food_entries")
    .alterColumn("chosen_quantity", (col) => col.setNotNull())
    .alterColumn("chosen_unit", (col) => col.setNotNull())
    .alterColumn("quantity_serving", (col) => col.setNotNull())
    .alterColumn("serving_label", (col) => col.setNotNull())
    .execute();

  await db.schema.alterTable("food_entries").dropColumn("quantity").dropColumn("quantity_unit").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("food_entries")
    .addColumn("quantity", "numeric(5, 2)")
    .addColumn("quantity_unit", "varchar(20)")
    .execute();

  await db
    .updateTable("food_entries")
    .set({
      quantity: sql`chosen_quantity`,
      quantity_unit: sql`chosen_unit`,
    })
    .execute();

  await db.schema
    .alterTable("food_entries")
    .alterColumn("quantity", (col) => col.setNotNull())
    .alterColumn("quantity_unit", (col) => col.setNotNull())
    .execute();

  await db.schema
    .alterTable("food_entries")
    .dropColumn("chosen_quantity")
    .dropColumn("chosen_unit")
    .dropColumn("quantity_serving")
    .dropColumn("serving_label")
    .dropColumn("quantity_mass")
    .dropColumn("mass_unit")
    .dropColumn("quantity_volume")
    .dropColumn("volume_unit")
    .execute();
}
