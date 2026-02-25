import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("email", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("password_hash", "varchar(255)", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("updated_at", "timestamp", (col) => col.notNull())
    .addColumn("tier", "varchar(5)", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("meals")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("name", "varchar(9)", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("food_entries")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("meal_id", "uuid", (col) => col.references("meals.id").notNull())
    .addColumn("name", "varchar(100)", (col) => col.notNull())
    .addColumn("brand", "varchar(75)")
    .addColumn("icon_name", "varchar(50)")
    .addColumn("quantity", "numeric(5, 2)", (col) => col.notNull())
    .addColumn("quantity_unit", "varchar(20)", (col) => col.notNull())
    .addColumn("calories", "numeric(5, 1)", (col) => col.notNull())
    .addColumn("total_fat_grams", "numeric(5, 1)", (col) => col.notNull())
    .addColumn("saturated_fat_grams", "numeric(5, 1)")
    .addColumn("cholesterol_mg", "smallint")
    .addColumn("sodium_mg", "smallint")
    .addColumn("total_carbohydrate_grams", "numeric(5, 1)", (col) =>
      col.notNull(),
    )
    .addColumn("fiber_grams", "numeric(5, 1)")
    .addColumn("sugar_grams", "numeric(5, 1)")
    .addColumn("protein_grams", "numeric(5, 1)", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("updated_at", "timestamp", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("day_logs")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("date", "date", (col) => col.notNull())
    .addColumn("user_id", "uuid", (col) => col.references("users.id").notNull())
    .addColumn("breakfast_id", "uuid", (col) => col.references("meals.id"))
    .addColumn("lunch_id", "uuid", (col) => col.references("meals.id"))
    .addColumn("dinner_id", "uuid", (col) => col.references("meals.id"))
    .addColumn("snacks_id", "uuid", (col) => col.references("meals.id"))
    .addColumn("weight", "numeric(5, 1)")
    .addColumn("created_at", "timestamp", (col) => col.notNull())
    .addColumn("updated_at", "timestamp", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("idx_day_logs_by_user_and_date")
    .on("day_logs")
    .columns(["user_id", "date"])
    .unique()
    .execute();

  await db.schema
    .createIndex("idx_food_entries_by_meal_id")
    .on("food_entries")
    .columns(["meal_id"])
    .execute();
}
