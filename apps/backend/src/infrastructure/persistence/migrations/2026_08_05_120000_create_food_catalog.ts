import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);

  await db.schema
    .createTable("food_catalog")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("name", "varchar(160)", (column) => column.notNull())
    .addColumn("brand", "varchar(160)")
    .addColumn("quantity_serving", "numeric(8, 2)", (column) => column.notNull())
    .addColumn("serving_label", "varchar(80)", (column) => column.notNull())
    .addColumn("quantity_mass", "numeric(8, 2)")
    .addColumn("mass_unit", "varchar(20)")
    .addColumn("quantity_volume", "numeric(8, 2)")
    .addColumn("volume_unit", "varchar(20)")
    .addColumn("calories", "numeric(8, 2)", (column) => column.notNull())
    .addColumn("total_fat_grams", "numeric(8, 2)", (column) => column.notNull())
    .addColumn("saturated_fat_grams", "numeric(8, 2)")
    .addColumn("cholesterol_mg", "numeric(8, 2)")
    .addColumn("sodium_mg", "numeric(8, 2)")
    .addColumn("total_carbohydrate_grams", "numeric(8, 2)", (column) => column.notNull())
    .addColumn("fiber_grams", "numeric(8, 2)")
    .addColumn("sugar_grams", "numeric(8, 2)")
    .addColumn("protein_grams", "numeric(8, 2)", (column) => column.notNull())
    .addColumn("source", "varchar(40)", (column) => column.notNull())
    .addColumn("source_food_id", "varchar(100)", (column) => column.notNull())
    .addColumn("normalized_gtin", "varchar(14)")
    .addColumn("verification_state", "varchar(40)", (column) => column.notNull())
    .addColumn("search_text", "text", (column) => column.notNull())
    .addColumn("search_vector", sql`tsvector`, (column) => column.notNull())
    .addColumn("popularity", "integer", (column) => column.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (column) => column.notNull())
    .addColumn("updated_at", "timestamptz", (column) => column.notNull())
    .execute();

  await db.schema.alterTable("food_entries").addColumn("food_catalog_id", "uuid", (column) => column.references("food_catalog.id")).execute();
  await sql`CREATE UNIQUE INDEX food_catalog_source_identity ON food_catalog (source, source_food_id)`.execute(db);
  await sql`CREATE UNIQUE INDEX food_catalog_normalized_gtin ON food_catalog (normalized_gtin) WHERE normalized_gtin IS NOT NULL`.execute(db);
  await sql`CREATE INDEX food_catalog_search_vector_gin ON food_catalog USING gin (search_vector)`.execute(db);
  await sql`CREATE INDEX food_catalog_search_text_trgm_gin ON food_catalog USING gin (search_text gin_trgm_ops)`.execute(db);
  await sql`CREATE INDEX food_entries_recent_search_idx ON food_entries (day_log_id, created_at DESC)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("food_entries").dropColumn("food_catalog_id").execute();
  await db.schema.dropTable("food_catalog").execute();
}
