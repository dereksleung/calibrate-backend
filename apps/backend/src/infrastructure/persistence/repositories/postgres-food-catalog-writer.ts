import { randomUUID } from "node:crypto";

import type { IFoodCatalogWriter, FoodCatalogInput, FoodCatalogRecord } from "@application/ports/food-catalog-writer.js";
import { sql } from "kysely";

import type { DatabaseClient } from "../database-client.js";
import type { SelectableFoodCatalog } from "../schemas/food-catalog-table.js";

function mapRow(row: SelectableFoodCatalog): FoodCatalogRecord {
  return {
    id: row.id, name: row.name, brand: row.brand, quantityServing: row.quantity_serving, servingLabel: row.serving_label,
    quantityMass: row.quantity_mass, massUnit: row.mass_unit, quantityVolume: row.quantity_volume, volumeUnit: row.volume_unit,
    calories: row.calories, totalFatGrams: row.total_fat_grams, saturatedFatGrams: row.saturated_fat_grams,
    cholesterolMg: row.cholesterol_mg, sodiumMg: row.sodium_mg, totalCarbohydrateGrams: row.total_carbohydrate_grams,
    fiberGrams: row.fiber_grams, sugarGrams: row.sugar_grams, proteinGrams: row.protein_grams, source: row.source,
    sourceFoodId: row.source_food_id, normalizedGtin: row.normalized_gtin, verificationState: "verified", popularity: row.popularity,
  };
}

export class PostgresFoodCatalogWriter implements IFoodCatalogWriter {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async upsert(input: FoodCatalogInput): Promise<FoodCatalogRecord> {
    const now = new Date().toISOString();
    const searchText = `${input.name} ${input.brand ?? ""}`.trim().toLowerCase();
    const values = {
      id: randomUUID(), name: input.name, brand: input.brand, quantity_serving: input.quantityServing,
      serving_label: input.servingLabel, quantity_mass: input.quantityMass, mass_unit: input.massUnit,
      quantity_volume: input.quantityVolume, volume_unit: input.volumeUnit, calories: input.calories,
      total_fat_grams: input.totalFatGrams, saturated_fat_grams: input.saturatedFatGrams,
      cholesterol_mg: input.cholesterolMg, sodium_mg: input.sodiumMg,
      total_carbohydrate_grams: input.totalCarbohydrateGrams, fiber_grams: input.fiberGrams,
      sugar_grams: input.sugarGrams, protein_grams: input.proteinGrams, source: input.source,
      source_food_id: input.sourceFoodId, normalized_gtin: input.normalizedGtin,
      verification_state: input.verificationState, search_text: searchText,
      search_vector: sql`setweight(to_tsvector('simple', ${input.name}), 'A') || setweight(to_tsvector('simple', ${input.brand ?? ""}), 'B')`,
      popularity: 0, created_at: now, updated_at: now,
    };
    const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...updateValues } = values;
    const row = await this.databaseClient.insertInto("food_catalog").values(values)
      .onConflict((conflict) => conflict.columns(["source", "source_food_id"]).doUpdateSet({
        ...updateValues, updated_at: new Date(),
      }))
      .returningAll().executeTakeFirst();
    if (!row) throw new Error("Failed to upsert food catalog item");
    return mapRow(row);
  }
}
